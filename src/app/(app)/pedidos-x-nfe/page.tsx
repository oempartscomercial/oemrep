import { Download } from "lucide-react";
import { obterUsuarioLogado } from "@/lib/sessao";
import { buscarPedidosParaGap } from "./queries";
import { calcularGap, filtrarGap, totaisPorAno, type LinhaGap } from "@/domain/analise/gap";
import { PageContainer } from "@/components/layouts/page-container";
import { PageHeader } from "@/components/patterns/page-header";
import { SessaoExpirada } from "@/components/patterns/sessao-expirada";
import { Botao } from "@/components/patterns/botao";
import { PedidosXNfeFiltros } from "./pedidos-x-nfe-filtros";
import { PedidosXNfeTabela, type LinhaGapView } from "./pedidos-x-nfe-tabela";
import { formatarReais as brl } from "@/domain/formato/moeda";

function opcoesUnicas(valores: string[]): { id: string; label: string }[] {
  return [...new Set(valores)].sort().map((v) => ({ id: v, label: v }));
}

export default async function PedidosXNfePage({
  searchParams,
}: {
  searchParams: Promise<{ fabrica?: string; cliente?: string; ano?: string; mes?: string }>;
}) {
  const { fabrica, cliente, ano, mes } = await searchParams;

  const usuario = await obterUsuarioLogado();
  if (!usuario) {
    return (
      <PageContainer>
        <SessaoExpirada />
      </PageContainer>
    );
  }

  const pedidos = await buscarPedidosParaGap(usuario);
  const todasLinhas: LinhaGap[] = calcularGap(pedidos);

  const linhasFiltradas = filtrarGap(todasLinhas, { fabrica, cliente, ano, mes });
  const anuais = totaisPorAno(linhasFiltradas);

  const linhasView: LinhaGapView[] = linhasFiltradas.map((l, i) => ({
    id: `${l.mes}-${l.fabrica}-${l.cliente}-${i}`,
    mes: l.mes,
    fabrica: l.fabrica,
    cliente: l.cliente,
    valorPedido: brl(l.valorPedido),
    valorFaturado: brl(l.valorFaturado),
    gap: l.gap,
    gapFmt: brl(l.gap),
  }));

  // Resumo mensal (gap total por mês) para o gráfico de barras em CSS.
  const gapPorMes = new Map<string, number>();
  for (const l of linhasFiltradas) gapPorMes.set(l.mes, (gapPorMes.get(l.mes) ?? 0) + l.gap);
  const resumo = [...gapPorMes.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  const gapMax = Math.max(1, ...resumo.map(([, total]) => total));

  const qs = new URLSearchParams();
  if (fabrica) qs.set("fabrica", fabrica);
  if (cliente) qs.set("cliente", cliente);
  if (ano) qs.set("ano", ano);
  if (mes) qs.set("mes", mes);

  return (
    <PageContainer>
      <PageHeader
        titulo="Pedidos × NFe"
        descricao="Gap de faturamento (valor de produtos) por mês, fábrica e cliente."
        acoes={
          <Botao href={`/api/export/pedidos-x-nfe?${qs.toString()}`} icone={<Download />}>
            Exportar XLSX
          </Botao>
        }
      />

      <PedidosXNfeFiltros
        fabricas={opcoesUnicas(todasLinhas.map((l) => l.fabrica))}
        clientes={opcoesUnicas(todasLinhas.map((l) => l.cliente))}
        anos={opcoesUnicas(todasLinhas.map((l) => l.mes.slice(0, 4))).reverse()}
        meses={opcoesUnicas(todasLinhas.map((l) => l.mes))}
        selecionado={{ fabrica, cliente, ano, mes }}
      />

      {anuais.length > 0 && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {anuais.map((t) => (
            <div key={t.ano} className="flex flex-col gap-2 rounded-lg border bg-card px-4 py-3">
              <span className="text-sm font-semibold">Total {t.ano}</span>
              <dl className="grid grid-cols-3 gap-2 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Pedidos</dt>
                  <dd className="font-medium tabular">{brl(t.valorPedido)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Com NFe</dt>
                  <dd className="font-medium tabular">{brl(t.valorFaturado)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Gap</dt>
                  <dd className={t.gap > 0 ? "font-semibold tabular text-destructive" : "font-medium tabular"}>{brl(t.gap)}</dd>
                </div>
              </dl>
            </div>
          ))}
        </div>
      )}

      {resumo.length > 0 && (
        <div className="flex flex-col gap-3 rounded-lg border bg-card p-4">
          <h2 className="text-sm font-semibold">Gap total por mês</h2>
          <ul className="flex flex-col gap-2">
            {resumo.map(([mesLabel, total]) => (
              <li key={mesLabel} className="flex items-center gap-3">
                <span className="w-20 shrink-0 text-sm text-muted-foreground">{mesLabel}</span>
                <span className="h-2.5 rounded-sm bg-destructive" style={{ width: `${Math.max(2, (total / gapMax) * 100)}%` }} aria-hidden />
                <span className="text-sm font-medium tabular">{brl(total)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <PedidosXNfeTabela linhas={linhasView} />
    </PageContainer>
  );
}
