import Link from "next/link";
import { Bell, FileQuestion, Package, TriangleAlert, Truck, type LucideIcon } from "lucide-react";
import { obterUsuarioLogado } from "@/lib/sessao";
import { cn } from "@/lib/utils";
import { buscarResumoDashboard, buscarSerieMensal, buscarTarefasCrm } from "./queries";
import { descreverPrazo, hojeEmSaoPaulo, situacaoDoPrazo } from "@/domain/crm/prazo";
import { PageContainer } from "@/components/layouts/page-container";
import { PageHeader } from "@/components/patterns/page-header";
import { SessaoExpirada } from "@/components/patterns/sessao-expirada";
import { formatarReais } from "@/domain/formato/moeda";
import type { TipoAlerta } from "@/domain/alerta/fila";

const ICONE_ALERTA: Record<TipoAlerta, { icone: LucideIcon; classe: string }> = {
  CHAMADO_CRITICO: { icone: TriangleAlert, classe: "text-destructive" },
  SEM_NOTA: { icone: Package, classe: "text-warning" },
  NOTA_PARADA: { icone: Truck, classe: "text-warning" },
  SEM_RASTREIO: { icone: Truck, classe: "text-muted-foreground" },
  RAPIDO_SEM_ITENS: { icone: FileQuestion, classe: "text-muted-foreground" },
};

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

  const agora = new Date();
  const { kpis, fabricas, fila } = await buscarResumoDashboard(usuario, agora);
  const nomeMes = agora.toLocaleDateString("pt-BR", { month: "long", timeZone: "America/Sao_Paulo" });

  const serie = await buscarSerieMensal(usuario);
  const tarefas = await buscarTarefasCrm(usuario);
  const hoje = hojeEmSaoPaulo();
  const serieMax = Math.max(1, ...serie.map((p) => Math.max(p.valorPedido, p.valorNfe)));
  const brl = formatarReais;
  const rotuloMes = (mes: string) => {
    const [ano, m] = mes.split("-");
    return `${["", "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"][Number(m)]}/${ano.slice(2)}`;
  };

  const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
  const cartoes = [
    {
      rotulo: "Sem nota",
      valor: brl(kpis.semNota.valor),
      icone: Package,
      dica: kpis.semNota.quantidade === 0 ? "Nada esperando a fábrica" : `${plural(kpis.semNota.quantidade, "pedido esperando", "pedidos esperando")} a fábrica`,
      href: "/pedidos?filtro=SEM_NOTA",
      alerta: false,
    },
    {
      rotulo: "Notas em trânsito",
      valor: String(kpis.nfesTransito),
      icone: Truck,
      dica: kpis.notasSemNoticia > 0 ? `${plural(kpis.notasSemNoticia, "sem notícia", "sem notícia")} há 5 dias ou mais` : "Todas com notícia recente",
      href: "/rastreio?filtro=PARADAS",
      alerta: kpis.notasSemNoticia > 0,
      // O número é o total em trânsito; o vermelho fica só no ícone, a dica diz quantas pararam.
      soIcone: true,
    },
    { rotulo: "Divergências abertas", valor: String(kpis.divergenciasAbertas), icone: TriangleAlert, dica: "Chamados sem resolução", href: "/divergencias", alerta: kpis.divergenciasAbertas > 0 },
    { rotulo: "Alertas", valor: String(kpis.alertas), icone: Bell, dica: "Precisam de uma ação", href: "/alertas", alerta: kpis.alertas > 0 },
  ];

  const filaVisivel = fila.slice(0, FILA_MAX);
  const linkClasse = "underline-offset-4 hover:underline";

  return (
    <PageContainer>
      <PageHeader
        titulo="Início"
        descricao={
          kpis.semNota.quantidade === 0
            ? "Nenhum pedido esperando nota da fábrica."
            : `Sem nota: ${plural(kpis.semNota.quantidade, "pedido", "pedidos")} · ${brl(kpis.semNota.valor)} a faturar`
        }
      />

      {tarefas && (
        <div className="flex flex-col gap-3 rounded-lg border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Para fazer hoje</h2>
            <div className="flex gap-3 text-sm">
              {tarefas.candidatas > 0 && (
                <Link href="/funis" className={linkClasse}>
                  {tarefas.candidatas} {tarefas.candidatas === 1 ? "empresa esperando" : "empresas esperando"} avaliação
                </Link>
              )}
              <Link href="/funis" className={linkClasse}>Ver funil</Link>
            </div>
          </div>
          {tarefas.passos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum próximo passo vencendo hoje.</p>
          ) : (
            <ul className="flex flex-col divide-y">
              {tarefas.passos.map((p) => {
                const atrasado = situacaoDoPrazo(p.prazo, hoje) === "atrasado";
                return (
                  <li key={p.id}>
                    <Link href={`/empresas/${p.empresaId}`} className="flex items-center gap-3 py-2 hover:bg-muted/40">
                      <span className="flex-1 text-sm">
                        <span className="font-medium">{p.empresa}</span>
                        <span className="text-muted-foreground"> · {p.acao}</span>
                      </span>
                      <span className={cn("text-xs", atrasado ? "font-medium text-destructive" : "text-muted-foreground")}>{descreverPrazo(p.prazo, hoje)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      <div className="hidden grid-cols-2 gap-3 md:grid xl:grid-cols-4">
        {cartoes.map((c) => {
          const Icone = c.icone;
          return (
            <Link key={c.rotulo} href={c.href} className="flex flex-col gap-1 rounded-lg border bg-card px-4 py-3 hover:bg-muted/40">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{c.rotulo}</span>
                <Icone className={cn("size-4", c.alerta ? "text-destructive" : "text-muted-foreground")} aria-hidden />
              </div>
              <p className={cn("text-2xl font-semibold tabular", c.alerta && !("soIcone" in c) && "text-destructive")}>{c.valor}</p>
              <p className="text-xs text-muted-foreground">{c.dica}</p>
            </Link>
          );
        })}
      </div>

      <section aria-labelledby="fila-do-dia" className="flex flex-col gap-3 rounded-lg border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="fila-do-dia" className="text-sm font-semibold">Fila do dia</h2>
          <Link href="/alertas" className={cn("text-sm", linkClasse)}>
            {fila.length > 0 ? `Ver todos os alertas (${fila.length})` : "Ver alertas"}
          </Link>
        </div>

        {filaVisivel.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nada pendente. Tudo em dia.</p>
        ) : (
          <ul className="flex flex-col divide-y">
            {filaVisivel.map((item) => {
              const { icone: Icone, classe } = ICONE_ALERTA[item.tipo];
              return (
                <li key={item.chave}>
                  <Link href={item.href} className="flex items-start gap-3 py-2 hover:bg-muted/40 sm:items-center">
                    <Icone className={cn("mt-0.5 size-4 shrink-0 sm:mt-0", classe)} aria-hidden />
                    <span className="flex min-w-0 flex-1 flex-col sm:flex-row sm:items-baseline sm:gap-2">
                      <span className="text-sm font-medium">{item.titulo}</span>
                      <span className="text-xs text-muted-foreground sm:truncate">{item.detalhe}</span>
                    </span>
                    {item.valor !== null && item.valor > 0 && <span className="shrink-0 text-xs tabular text-muted-foreground">{brl(item.valor)}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        {fila.length > FILA_MAX && (
          <p className="text-xs text-muted-foreground">Mostrando os {FILA_MAX} mais urgentes de {fila.length}.</p>
        )}
      </section>

      <section aria-labelledby="por-fabrica" className="flex flex-col gap-3">
        <h2 id="por-fabrica" className="text-sm font-semibold">Por fábrica</h2>
        {fabricas.length === 0 ? (
          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            Nenhuma fábrica cadastrada ainda.{" "}
            {usuario.perfil === "ADMIN" && (
              <Link href="/cadastros/fabricas/novo" className={cn("text-foreground", linkClasse)}>
                Cadastrar a primeira
              </Link>
            )}
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {fabricas.map((f) => (
              // No celular, fábrica sem nada aberto nem movimento no mês só ocupa espaço.
              <li key={f.id} className={cn(f.aFaturar === 0 && f.pedidosMes === 0 && f.notasMes === 0 && "hidden sm:block")}>
                <Link
                  href={`/pedidos?filtro=EM_ANDAMENTO&fabrica=${f.id}`}
                  className="flex h-full flex-col gap-3 rounded-lg border bg-card px-4 py-3 hover:bg-muted/40"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-semibold">{f.nome}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{plural(f.pedidosAbertos, "pedido aberto", "pedidos abertos")}</span>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">A faturar</p>
                    <p className="text-xl font-semibold tabular">{brl(f.aFaturar)}</p>
                  </div>
                  <dl className="grid grid-cols-2 gap-2 border-t pt-2 text-xs">
                    <div>
                      <dt className="text-muted-foreground">Recebido em {nomeMes}</dt>
                      <dd className="font-medium tabular">{brl(f.recebidoMes)}</dd>
                      <dd className="text-muted-foreground">{plural(f.pedidosMes, "pedido", "pedidos")}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Faturado em {nomeMes}</dt>
                      <dd className="font-medium tabular">{brl(f.faturadoMes)}</dd>
                      <dd className="text-muted-foreground">{plural(f.notasMes, "nota", "notas")}</dd>
                    </div>
                  </dl>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="hidden flex-col gap-4 rounded-lg border bg-card p-4 md:flex">
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

    </PageContainer>
  );
}
