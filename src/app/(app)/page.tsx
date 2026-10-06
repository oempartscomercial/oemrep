import Link from "next/link";
import { Bell, Package, TriangleAlert, Truck } from "lucide-react";
import { obterUsuarioLogado } from "@/lib/sessao";
import { cn } from "@/lib/utils";
import { buscarResumoDashboard, buscarSerieMensal } from "./queries";
import { PageContainer } from "@/components/layouts/page-container";
import { PageHeader } from "@/components/patterns/page-header";
import { SessaoExpirada } from "@/components/patterns/sessao-expirada";

const FILA_MAX = 8;

export default async function InicioPage() {
  const usuario = await obterUsuarioLogado();
  if (!usuario) {
    return (
      <PageContainer>
        <SessaoExpirada />
      </PageContainer>
    );
  }

  const { kpis, fila } = await buscarResumoDashboard(usuario);

  const serie = await buscarSerieMensal(usuario);
  const serieMax = Math.max(1, ...serie.map((p) => Math.max(p.valorPedido, p.valorNfe)));
  const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const rotuloMes = (mes: string) => {
    const [ano, m] = mes.split("-");
    return `${["", "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"][Number(m)]}/${ano.slice(2)}`;
  };

  const cartoes = [
    { rotulo: "Pedidos ativos", valor: kpis.pedidosAtivos, icone: Package, dica: "Ainda não arquivados", alerta: false },
    { rotulo: "NFes em trânsito", valor: kpis.nfesTransito, icone: Truck, dica: "Aguardando recebimento", alerta: false },
    { rotulo: "Divergências abertas", valor: kpis.divergenciasAbertas, icone: TriangleAlert, dica: "Chamados sem resolução", alerta: kpis.divergenciasAbertas > 0 },
    { rotulo: "Alertas (sem NFe)", valor: kpis.alertas, icone: Bell, dica: "Pedidos fora do prazo", alerta: kpis.alertas > 0 },
  ];

  const filaVisivel = fila.slice(0, FILA_MAX);
  const linkClasse = "underline-offset-4 hover:underline";

  return (
    <PageContainer>
      <PageHeader titulo="Início" descricao="Visão geral da operação de representação comercial." />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {cartoes.map((c) => {
          const Icone = c.icone;
          return (
            <div key={c.rotulo} className="flex flex-col gap-1 rounded-lg border bg-card px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{c.rotulo}</span>
                <Icone className={cn("size-4", c.alerta ? "text-destructive" : "text-muted-foreground")} aria-hidden />
              </div>
              <p className={cn("text-2xl font-semibold tabular", c.alerta && "text-destructive")}>{c.valor}</p>
              <p className="text-xs text-muted-foreground">{c.dica}</p>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-4 rounded-lg border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Pedidos × NFes por mês</h2>
          {usuario.perfil === "ADMIN" && (
            <Link href="/historico/importar" className={cn("text-sm", linkClasse)}>
              Importar histórico
            </Link>
          )}
        </div>

        {serie.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem dados ainda. Importe o histórico ou registre pedidos e NFes.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {serie.map((p) => (
              <li key={p.mes} className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted-foreground">{rotuloMes(p.mes)}</span>
                <div className="flex items-center gap-3">
                  <span className="w-10 shrink-0 text-xs text-muted-foreground">Ped.</span>
                  <span className="h-2.5 rounded-sm bg-foreground/70" style={{ width: `${Math.max(2, (p.valorPedido / serieMax) * 100)}%` }} aria-hidden />
                  <span className="text-sm tabular">{brl(p.valorPedido)}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-10 shrink-0 text-xs text-muted-foreground">NFe</span>
                  <span className="h-2.5 rounded-sm bg-success" style={{ width: `${Math.max(2, (p.valorNfe / serieMax) * 100)}%` }} aria-hidden />
                  <span className="text-sm tabular">{brl(p.valorNfe)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-3 rounded-lg border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Fila do dia</h2>
          <div className="flex gap-3 text-sm">
            <Link href="/alertas" className={linkClasse}>Ver alertas</Link>
            <Link href="/divergencias" className={linkClasse}>Ver divergências</Link>
          </div>
        </div>

        {filaVisivel.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nada pendente. Tudo em dia. 🎉</p>
        ) : (
          <ul className="flex flex-col divide-y">
            {filaVisivel.map((item) => (
              <li key={`${item.tipo}-${item.href}`}>
                <Link href={item.href} className="flex items-center gap-3 py-2 hover:bg-muted/40">
                  <span className={item.tipo === "CRITICO" ? "text-destructive" : "text-muted-foreground"}>
                    {item.tipo === "CRITICO" ? <TriangleAlert className="size-4" aria-hidden /> : <Bell className="size-4" aria-hidden />}
                  </span>
                  <span className="flex-1 text-sm font-medium">{item.titulo}</span>
                  <span className="text-xs text-muted-foreground">{item.detalhe}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {fila.length > FILA_MAX && (
          <p className="text-xs text-muted-foreground">Mostrando os {FILA_MAX} itens mais urgentes de {fila.length}.</p>
        )}
      </div>
    </PageContainer>
  );
}
