"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Info } from "lucide-react";
import { abreviarReais, formatarReais } from "@/domain/formato/moeda";
import { inicioDoAcompanhamentoNfe, recortarSerie, type Periodo } from "@/domain/analise/periodo";
import type { PontoMensal } from "@/domain/analise/totaisMensais";
import { cn } from "@/lib/utils";

const PERIODOS: { id: Periodo; rotulo: string; curto: string }[] = [
  { id: "6m", rotulo: "6 meses", curto: "6m" },
  { id: "12m", rotulo: "12 meses", curto: "12m" },
  { id: "24m", rotulo: "24 meses", curto: "24m" },
  { id: "ano", rotulo: "Este ano", curto: "Ano" },
  { id: "tudo", rotulo: "Tudo", curto: "Tudo" },
];

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MESES_LONGOS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const curto = (mes: string) => `${MESES[Number(mes.slice(5)) - 1]}/${mes.slice(2, 4)}`;
const longo = (mes: string) => `${MESES_LONGOS[Number(mes.slice(5)) - 1]} de ${mes.slice(0, 4)}`;

/** Topo do eixo "redondo" (1, 2, 2,5 ou 5 × 10^n) e quatro divisões. */
function escala(maximo: number): number[] {
  if (maximo <= 0) return [0, 1];
  const bruto = maximo / 4;
  const potencia = 10 ** Math.floor(Math.log10(bruto));
  const passo = [1, 2, 2.5, 5, 10].map((m) => m * potencia).find((p) => p >= bruto) ?? 10 * potencia;
  return [0, 1, 2, 3, 4].map((i) => i * passo);
}

/**
 * Pedidos recebidos × NFe emitidas por mês, em colunas lado a lado. Pedido recebido não é
 * faturamento: as duas séries ficam juntas para comparar, nunca somadas.
 */
export function GraficoMensal({ serie, mesAtual, podeImportar }: { serie: PontoMensal[]; mesAtual: string; podeImportar: boolean }) {
  const [periodo, setPeriodo] = useState<Periodo>("12m");
  const [ativo, setAtivo] = useState<string | null>(null);

  const pontos = useMemo(() => recortarSerie(serie, periodo, mesAtual), [serie, periodo, mesAtual]);
  const inicioNfe = inicioDoAcompanhamentoNfe(serie);
  const semNfe = (mes: string) => inicioNfe === null || mes < inicioNfe;
  const ticks = escala(Math.max(...pontos.map((p) => Math.max(p.valorPedido, p.valorNfe))));
  const topo = ticks[ticks.length - 1];
  const totalPedidos = pontos.reduce((s, p) => s + p.valorPedido, 0);
  const totalNfe = pontos.reduce((s, p) => s + p.valorNfe, 0);
  const avisoNfe = pontos.some((p) => semNfe(p.mes));
  // Rótulos do eixo X: até 12 no desktop, até 4 no celular (o resto fica no toque/tooltip).
  const passoDesktop = Math.ceil(pontos.length / 12);
  const passoCelular = Math.ceil(pontos.length / 4);
  const largo = pontos.length > 13;
  const pontoAtivo = pontos.find((p) => p.mes === ativo) ?? null;
  const indiceAtivo = pontoAtivo ? pontos.indexOf(pontoAtivo) : -1;

  return (
    <section aria-labelledby="grafico-mensal" className="flex flex-col gap-4 rounded-xl border bg-card p-4 shadow-xs md:p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-col gap-2">
          <h2 id="grafico-mensal" className="text-base font-semibold tracking-tight">Pedidos recebidos × NFe emitidas</h2>
          <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <div className="flex items-center gap-2">
              <span className="size-2.5 rounded-sm bg-chart-1" aria-hidden />
              <dt className="text-muted-foreground">Pedidos recebidos</dt>
              <dd className="font-semibold tabular">{abreviarReais(totalPedidos)}</dd>
            </div>
            <div className="flex items-center gap-2">
              <span className="size-2.5 rounded-sm bg-chart-2" aria-hidden />
              <dt className="text-muted-foreground">NFe emitidas</dt>
              <dd className="font-semibold tabular">{abreviarReais(totalNfe)}</dd>
            </div>
          </dl>
        </div>
        <div role="radiogroup" aria-label="Período do gráfico" className="grid w-full grid-cols-5 rounded-lg bg-muted p-0.5 lg:w-auto">
          {PERIODOS.map((p) => (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={periodo === p.id}
              onClick={() => {
                setPeriodo(p.id);
                setAtivo(null);
              }}
              className={cn(
                "h-9 rounded-md px-2 text-xs sm:px-3 font-medium whitespace-nowrap text-muted-foreground transition-colors md:h-7",
                periodo === p.id ? "bg-card text-foreground shadow-xs" : "hover:text-foreground",
              )}
            >
              <span className="sm:hidden">{p.curto}</span>
              <span className="hidden sm:inline">{p.rotulo}</span>
            </button>
          ))}
        </div>
      </div>

      {serie.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
          Sem dados ainda. {podeImportar ? "Importe o histórico ou registre pedidos e NFes." : "Os meses aparecem aqui conforme pedidos e NFes forem registrados."}
        </p>
      ) : (
      <div className="relative flex gap-2">
        {/* Eixo Y: valores abreviados; o exato aparece ao passar o mouse (ou tocar) na coluna. */}
        <div className="relative mt-3 h-56 w-16 shrink-0 text-right text-xs text-muted-foreground tabular" aria-hidden>
          {ticks.map((t) => (
            <span key={t} className="absolute right-0 translate-y-1/2 whitespace-nowrap" style={{ bottom: `${(t / topo) * 100}%` }}>
              {t === 0 ? "R$ 0" : abreviarReais(t)}
            </span>
          ))}
        </div>

        <div className="min-w-0 flex-1 overflow-x-auto pt-3">
          <div className={cn("relative", largo && "min-w-[44rem]")} onMouseLeave={() => setAtivo(null)}>
            <div className="relative h-56">
              {ticks.map((t) => (
                <span key={t} aria-hidden className={cn("absolute inset-x-0 border-t", t === 0 ? "border-foreground/25" : "border-dashed border-border")} style={{ bottom: `${(t / topo) * 100}%` }} />
              ))}
              <div className="absolute inset-0 flex items-end">
                {pontos.map((p) => {
                  const ehAtivo = p.mes === ativo;
                  return (
                    <button
                      key={p.mes}
                      type="button"
                      aria-label={`${longo(p.mes)}: pedidos ${formatarReais(p.valorPedido)}; NFe ${semNfe(p.mes) ? "sem registro" : formatarReais(p.valorNfe)}`}
                      onMouseEnter={() => setAtivo(p.mes)}
                      onFocus={() => setAtivo(p.mes)}
                      onBlur={() => setAtivo(null)}
                      onClick={() => setAtivo((a) => (a === p.mes ? null : p.mes))}
                      className={cn("flex h-full min-w-0 flex-1 items-end justify-center gap-0.5 rounded-t-md px-0.5 sm:px-1.5 outline-none focus-visible:ring-2 focus-visible:ring-ring", ehAtivo && "bg-muted/70")}
                    >
                      <span className="w-full max-w-6 rounded-t-[4px] bg-chart-1 transition-[height] duration-200" style={{ height: `${(p.valorPedido / topo) * 100}%` }} />
                      {semNfe(p.mes) ? (
                        <span className="w-full max-w-6" />
                      ) : (
                        <span className="w-full max-w-6 rounded-t-[4px] bg-chart-2 transition-[height] duration-200" style={{ height: `${(p.valorNfe / topo) * 100}%` }} />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="mt-2 flex text-xs text-muted-foreground" aria-hidden>
              {pontos.map((p, i) => {
                const distancia = pontos.length - 1 - i;
                const noCelular = distancia % passoCelular === 0;
                const noDesktop = distancia % passoDesktop === 0;
                return (
                  <span key={p.mes} className={cn("min-w-0 flex-1 text-center whitespace-nowrap", !noDesktop && "invisible", noDesktop && !noCelular && "max-sm:invisible")}>
                    {curto(p.mes)}
                  </span>
                );
              })}
            </div>

            {pontoAtivo && (
              <div
                role="status"
                className="pointer-events-none absolute top-0 z-10 w-52 rounded-lg border bg-popover p-3 text-sm shadow-md"
                style={
                  indiceAtivo < pontos.length / 2
                    ? { left: `calc(${((indiceAtivo + 1) / pontos.length) * 100}% + 0.25rem)` }
                    : { right: `calc(${((pontos.length - indiceAtivo) / pontos.length) * 100}% + 0.25rem)` }
                }
              >
                <p className="font-semibold first-letter:uppercase">{longo(pontoAtivo.mes)}</p>
                <dl className="mt-2 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-3">
                    <dt className="flex items-center gap-1.5 text-muted-foreground"><span className="size-2 rounded-sm bg-chart-1" />Pedidos</dt>
                    <dd className="font-medium tabular">{formatarReais(pontoAtivo.valorPedido)}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="flex items-center gap-1.5 text-muted-foreground"><span className="size-2 rounded-sm bg-chart-2" />NFe</dt>
                    <dd className="font-medium tabular">{semNfe(pontoAtivo.mes) ? "sem registro" : formatarReais(pontoAtivo.valorNfe)}</dd>
                  </div>
                </dl>
              </div>
            )}
          </div>
        </div>
      </div>

      )}

      <div className="flex flex-col gap-2 border-t pt-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        {avisoNfe ? (
          <p className="flex items-start gap-1.5">
            <Info className="mt-px size-3.5 shrink-0" aria-hidden />
            {inicioNfe
              ? `As NFe passaram a ser acompanhadas em ${longo(inicioNfe)}. Antes disso a coluna de NFe fica vazia por falta de registro, não por falta de faturamento.`
              : "As NFe ainda não são acompanhadas aqui: a coluna fica vazia por falta de registro, não por falta de faturamento."}
          </p>
        ) : (
          <p>Pedido recebido não é faturamento: as duas colunas são para comparar, não para somar.</p>
        )}
        {podeImportar && (
          <Link href="/historico/importar" className="shrink-0 font-medium text-foreground underline-offset-4 hover:underline">
            Importar histórico
          </Link>
        )}
      </div>

      <div className="sr-only">
      <table>
        <caption>Pedidos recebidos e NFe emitidas por mês</caption>
        <thead>
          <tr><th>Mês</th><th>Pedidos recebidos</th><th>NFe emitidas</th></tr>
        </thead>
        <tbody>
          {pontos.map((p) => (
            <tr key={p.mes}><td>{longo(p.mes)}</td><td>{formatarReais(p.valorPedido)}</td><td>{semNfe(p.mes) ? "sem registro" : formatarReais(p.valorNfe)}</td></tr>
          ))}
        </tbody>
      </table>
      </div>
    </section>
  );
}
