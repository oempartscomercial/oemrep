import { cache } from "react";
import Link from "next/link";
import { ArrowRight, Bell, CircleCheck, FileQuestion, Package, TriangleAlert, Truck, type LucideIcon } from "lucide-react";
import type { UsuarioSessao } from "@/lib/sessao";
import { buscarResumoDashboard, buscarSerieMensal, buscarTarefasCrm } from "../queries";
import { mesEmSaoPaulo } from "@/domain/analise/painel";
import type { TipoAlerta } from "@/domain/alerta/fila";
import { formatarReais } from "@/domain/formato/moeda";
import { hojeEmSaoPaulo } from "@/domain/crm/prazo";
import { AvatarEmpresa } from "@/components/crm/avatar-iniciais";
import { PrazoSelo } from "@/components/crm/prazo-selo";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { GraficoMensal } from "./grafico-mensal";

// Cada bloco do Início busca o que precisa e chega em streaming, cada um no seu tempo.
// KPIs, fila e fábricas vêm do mesmo resumo: o `cache` faz a consulta uma vez por requisição.
const resumo = cache((usuario: UsuarioSessao) => buscarResumoDashboard(usuario, new Date()));

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
const CARTAO = "rounded-xl border bg-card shadow-xs";

function Cabecalho({ titulo, contagem, acao }: { titulo: string; contagem?: number; acao?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        {titulo}
        {contagem !== undefined && contagem > 0 && <span className="rounded-md bg-muted px-1.5 text-xs font-medium text-muted-foreground tabular">{contagem}</span>}
      </h2>
      {acao}
    </div>
  );
}

const linkDoCabecalho = "inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground";

// ---------------------------------------------------------------------------------------------

export async function Kpis({ usuario }: { usuario: UsuarioSessao }) {
  const { kpis } = await resumo(usuario);
  const cartoes: { rotulo: string; valor: string; icone: LucideIcon; dica: string; href: string; alerta: boolean; valorEmAlerta?: boolean }[] = [
    {
      rotulo: "Esperando nota",
      valor: formatarReais(kpis.semNota.valor),
      icone: Package,
      dica: kpis.semNota.quantidade === 0 ? "Nada esperando a fábrica" : `${plural(kpis.semNota.quantidade, "pedido", "pedidos")} sem nota da fábrica`,
      href: "/pedidos?filtro=SEM_NOTA",
      alerta: false,
    },
    {
      rotulo: "Notas em trânsito",
      valor: String(kpis.nfesTransito),
      icone: Truck,
      // O número é o total em trânsito; o vermelho fica só no ícone, a dica diz quantas pararam.
      dica: kpis.notasSemNoticia > 0 ? `${kpis.notasSemNoticia} sem notícia há 5 dias ou mais` : "Todas com notícia recente",
      href: "/rastreio?filtro=PARADAS",
      alerta: kpis.notasSemNoticia > 0,
    },
    { rotulo: "Divergências abertas", valor: String(kpis.divergenciasAbertas), icone: TriangleAlert, dica: "Chamados sem resolução", href: "/divergencias", alerta: kpis.divergenciasAbertas > 0, valorEmAlerta: true },
    { rotulo: "Alertas", valor: String(kpis.alertas), icone: Bell, dica: "Precisam de uma ação", href: "/alertas", alerta: kpis.alertas > 0, valorEmAlerta: true },
  ];
  return (
    <div className={cn(CARTAO, "grid grid-cols-2 overflow-hidden lg:grid-cols-4")}>
      {cartoes.map((c, i) => {
        const Icone = c.icone;
        return (
          <Link
            key={c.rotulo}
            href={c.href}
            className={cn("group flex flex-col gap-1 p-4 transition-colors hover:bg-muted/50", i % 2 === 1 && "border-l", i >= 2 && "border-t lg:border-t-0", i === 2 && "lg:border-l")}
          >
            <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <span className={cn("grid size-6 place-items-center rounded-md", c.alerta ? "bg-danger-soft text-destructive" : "bg-muted text-foreground/70")}>
                <Icone className="size-3.5" aria-hidden />
              </span>
              {c.rotulo}
            </span>
            <span className={cn("mt-1 text-lg font-semibold tracking-tight whitespace-nowrap tabular md:text-2xl", c.alerta && c.valorEmAlerta && "text-destructive")}>{c.valor}</span>
            <span className="text-xs text-muted-foreground">{c.dica}</span>
          </Link>
        );
      })}
    </div>
  );
}

export function KpisCarregando() {
  return <Skeleton className="h-[7.5rem] w-full rounded-xl" />;
}

// ---------------------------------------------------------------------------------------------

export async function Tarefas({ usuario }: { usuario: UsuarioSessao }) {
  const tarefas = await buscarTarefasCrm(usuario);
  if (!tarefas) return null;
  const hoje = hojeEmSaoPaulo();
  return (
    <section aria-labelledby="para-fazer-hoje" className={cn(CARTAO, "flex flex-col")}>
      <Cabecalho
        titulo="Para fazer hoje"
        contagem={tarefas.passos.length}
        acao={<Link href="/funis" className={linkDoCabecalho}>Abrir funil <ArrowRight className="size-3.5" /></Link>}
      />
      {tarefas.passos.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-1 px-4 py-8 text-center">
          <CircleCheck className="size-5 text-success" aria-hidden />
          <p className="text-sm font-medium">Nenhum passo vencendo hoje</p>
          <p className="text-xs text-muted-foreground">Os próximos passos com data aparecem aqui no dia.</p>
        </div>
      ) : (
        <ul className="flex flex-col divide-y">
          {tarefas.passos.map((p) => (
            <li key={p.id}>
              <Link href={`/empresas/${p.empresaId}`} className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/50">
                <AvatarEmpresa nome={p.empresa} tamanho="sm" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium">{p.empresa}</span>
                  <span className="truncate text-xs text-muted-foreground">{p.acao}</span>
                </span>
                <PrazoSelo prazo={p.prazo} hoje={hoje} />
              </Link>
            </li>
          ))}
        </ul>
      )}
      {tarefas.candidatas > 0 && (
        <Link href="/funis" className="mt-auto flex items-center justify-between gap-2 border-t bg-muted/40 px-4 py-2.5 text-sm transition-colors hover:bg-muted">
          <span>
            <span className="font-semibold tabular">{tarefas.candidatas}</span> {tarefas.candidatas === 1 ? "empresa esperando" : "empresas esperando"} sua avaliação
          </span>
          <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
        </Link>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------------------------

const ICONE_ALERTA: Record<TipoAlerta, { icone: LucideIcon; classe: string }> = {
  CHAMADO_CRITICO: { icone: TriangleAlert, classe: "bg-danger-soft text-destructive" },
  SEM_NOTA: { icone: Package, classe: "bg-warning-soft text-warning" },
  NOTA_PARADA: { icone: Truck, classe: "bg-warning-soft text-warning" },
  SEM_RASTREIO: { icone: Truck, classe: "bg-muted text-muted-foreground" },
  RAPIDO_SEM_ITENS: { icone: FileQuestion, classe: "bg-muted text-muted-foreground" },
};
const FILA_MAX = 8;

export async function Fila({ usuario }: { usuario: UsuarioSessao }) {
  const { fila } = await resumo(usuario);
  const visivel = fila.slice(0, FILA_MAX);
  return (
    <section aria-labelledby="fila-do-dia" className={cn(CARTAO, "flex flex-col")}>
      <Cabecalho
        titulo="Fila do dia"
        contagem={fila.length}
        acao={<Link href="/alertas" className={linkDoCabecalho}>Ver alertas <ArrowRight className="size-3.5" /></Link>}
      />
      {visivel.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-1 px-4 py-8 text-center">
          <CircleCheck className="size-5 text-success" aria-hidden />
          <p className="text-sm font-medium">Nada pendente nos pedidos</p>
          <p className="text-xs text-muted-foreground">Pedido sem nota, nota parada e chamado crítico aparecem aqui.</p>
        </div>
      ) : (
        <ul className="flex flex-col divide-y">
          {visivel.map((item) => {
            const { icone: Icone, classe } = ICONE_ALERTA[item.tipo];
            return (
              <li key={item.chave}>
                <Link href={item.href} className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/50">
                  <span className={cn("grid size-7 shrink-0 place-items-center rounded-md", classe)}>
                    <Icone className="size-3.5" aria-hidden />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium">{item.titulo}</span>
                    <span className="truncate text-xs text-muted-foreground">{item.detalhe}</span>
                  </span>
                  {item.valor !== null && item.valor > 0 && <span className="shrink-0 text-xs font-medium tabular text-muted-foreground">{formatarReais(item.valor)}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {fila.length > FILA_MAX && (
        <p className="mt-auto border-t px-4 py-2 text-xs text-muted-foreground">Mostrando os {FILA_MAX} mais urgentes de {fila.length}.</p>
      )}
    </section>
  );
}

export function ListaCarregando() {
  return (
    <div className={cn(CARTAO, "flex flex-col gap-3 p-4")}>
      <Skeleton className="h-4 w-32" />
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="size-7 rounded-md" />
          <Skeleton className="h-4 flex-1" />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------

export async function Grafico({ usuario }: { usuario: UsuarioSessao }) {
  const serie = await buscarSerieMensal(usuario);
  return <GraficoMensal serie={serie} mesAtual={mesEmSaoPaulo(new Date())} podeImportar={usuario.perfil === "ADMIN"} />;
}

export function GraficoCarregando() {
  return (
    <div className={cn(CARTAO, "flex flex-col gap-4 p-5")}>
      <Skeleton className="h-5 w-64" />
      <Skeleton className="h-56 w-full" />
    </div>
  );
}

// ---------------------------------------------------------------------------------------------

export async function PorFabrica({ usuario }: { usuario: UsuarioSessao }) {
  const { fabricas } = await resumo(usuario);
  const nomeMes = new Date().toLocaleDateString("pt-BR", { month: "long", timeZone: "America/Sao_Paulo" });
  const maiorDoMes = Math.max(1, ...fabricas.map((f) => Math.max(f.recebidoMes, f.faturadoMes)));
  return (
    <section aria-labelledby="por-fabrica" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-2">
        <h2 id="por-fabrica" className="text-base font-semibold tracking-tight">Por fábrica</h2>
        <p className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="size-2 rounded-sm bg-chart-1" aria-hidden />Recebido em {nomeMes}</span>
          <span className="flex items-center gap-1.5"><span className="size-2 rounded-sm bg-chart-2" aria-hidden />Faturado em {nomeMes}</span>
        </p>
      </div>
      {fabricas.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card p-4 text-sm text-muted-foreground">
          Nenhuma fábrica cadastrada ainda.{" "}
          {usuario.perfil === "ADMIN" && <Link href="/cadastros/fabricas/novo" className="font-medium text-foreground underline-offset-4 hover:underline">Cadastrar a primeira</Link>}
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {fabricas.map((f) => (
            // No celular, fábrica sem nada aberto nem movimento no mês só ocupa espaço.
            <li key={f.id} className={cn(f.aFaturar === 0 && f.pedidosMes === 0 && f.notasMes === 0 && "hidden sm:block")}>
              <Link href={`/pedidos?filtro=EM_ANDAMENTO&fabrica=${f.id}`} className={cn(CARTAO, "flex h-full flex-col gap-3 p-4 transition-colors hover:border-foreground/20")}>
                <div className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <AvatarEmpresa nome={f.nome} tamanho="sm" />
                    <span className="truncate text-sm font-semibold">{f.nome}</span>
                  </span>
                  <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">{plural(f.pedidosAbertos, "pedido aberto", "pedidos abertos")}</span>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">A faturar</p>
                  <p className={cn("text-xl font-semibold tracking-tight tabular", f.aFaturar === 0 && "text-muted-foreground")}>{formatarReais(f.aFaturar)}</p>
                </div>
                <dl className="flex flex-col gap-1.5 border-t pt-3 text-xs">
                  {[
                    { rotulo: "Recebido", valor: f.recebidoMes, qtd: plural(f.pedidosMes, "pedido", "pedidos"), cor: "bg-chart-1" },
                    { rotulo: "Faturado", valor: f.faturadoMes, qtd: plural(f.notasMes, "nota", "notas"), cor: "bg-chart-2" },
                  ].map((l) => (
                    <div key={l.rotulo} className="grid grid-cols-[4.5rem_1fr_auto] items-center gap-2">
                      <dt className="text-muted-foreground">{l.rotulo}</dt>
                      <span className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                        <span className={cn("block h-full rounded-full", l.cor)} style={{ width: `${(l.valor / maiorDoMes) * 100}%` }} />
                      </span>
                      <dd className="text-right font-medium tabular">
                        {formatarReais(l.valor)} <span className="font-normal text-muted-foreground">· {l.qtd}</span>
                      </dd>
                    </div>
                  ))}
                </dl>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function PorFabricaCarregando() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {[0, 1, 2].map((i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
    </div>
  );
}
