import { Suspense } from "react";
import Link from "next/link";
import { obterUsuarioLogado } from "@/lib/sessao";
import { listarResponsaveis } from "../empresas/queries";
import { buscarCarteira, buscarProspeccao, buscarSugestoes, dadosParaNovaOportunidade } from "./queries";
import { ETAPAS_DO_QUADRO } from "@/domain/crm/funil";
import { ETAPAS_DO_QUADRO_OP, ETAPAS_FORA_DO_QUADRO_OP } from "@/domain/crm/oportunidade";
import { hojeEmSaoPaulo } from "@/domain/crm/prazo";
import { ufNorteNordeste } from "@/domain/crm/regiao";
import { PageContainer } from "@/components/layouts/page-container";
import { PageHeader } from "@/components/patterns/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Quadro, type CartaoFunil } from "./quadro";
import { QuadroCarteira, type CartaoCarteira } from "./quadro-carteira";
import { Sugestoes } from "./sugestoes";
import { NovaOportunidadeBotao } from "./nova-oportunidade-botao";

type Passo = { acao: string; prazo: Date; responsavel: { nome: string } };
const resumirPasso = (p: Passo | undefined) => (p ? { acao: p.acao, prazo: p.prazo.toISOString().slice(0, 10), responsavel: p.responsavel.nome } : null);

// O quadro chega em streaming: o cabeçalho e as abas aparecem na hora, os cartões logo depois.
function QuadroCarregando({ colunas }: { colunas: number }) {
  return (
    <div className="grid auto-cols-[86%] grid-flow-col gap-3 overflow-hidden sm:auto-cols-[minmax(16rem,1fr)]" aria-busy="true" aria-label="Carregando o funil">
      {Array.from({ length: colunas }, (_, i) => (
        <div key={i} className="flex flex-col gap-2 rounded-xl bg-ink-soft/70 p-2">
          <Skeleton className="m-1 h-4 w-24 bg-card" />
          {[0, 1, 2].slice(0, 3 - (i % 2)).map((j) => <Skeleton key={j} className="h-28 rounded-lg bg-card" />)}
        </div>
      ))}
    </div>
  );
}

async function FunilProspeccao({ colunas, usuarioId }: { colunas: string[]; usuarioId: string }) {
  const hoje = hojeEmSaoPaulo();
  const [empresas, responsaveis] = await Promise.all([buscarProspeccao(colunas), listarResponsaveis()]);
  const cartoes: CartaoFunil[] = empresas.map((e) => ({
    id: e.id,
    nome: e.nomeFantasia,
    local: [e.cidade, e.uf].filter(Boolean).join("/"),
    foraDaRegiao: !!e.uf && !ufNorteNordeste(e.uf),
    situacao: e.situacao,
    passo: resumirPasso(e.proximosPassos[0]),
    ultimoContato: e.interacoes[0]?.data.toISOString().slice(0, 10) ?? null,
    naoContatar: e.naoContatar,
  }));
  return <Quadro cartoes={cartoes} colunas={colunas} responsaveis={responsaveis} usuarioId={usuarioId} hoje={hoje} />;
}

async function FunilCarteira({ colunas, mostrarFora, usuarioId }: { colunas: string[]; mostrarFora: boolean; usuarioId: string }) {
  const hoje = hojeEmSaoPaulo();
  const [oportunidades, responsaveis] = await Promise.all([buscarCarteira(mostrarFora), listarResponsaveis()]);
  const cartoes: CartaoCarteira[] = oportunidades.map((o) => ({
    id: o.id,
    clienteId: o.clienteId,
    cliente: o.cliente.nomeFantasia,
    fabrica: o.fabrica.nome,
    tipo: o.tipo,
    etapa: o.etapa,
    motivoPerda: o.motivoPerda,
    passo: resumirPasso(o.proximosPassos[0]),
  }));
  return <QuadroCarteira cartoes={cartoes} colunas={colunas} responsaveis={responsaveis} usuarioId={usuarioId} hoje={hoje} />;
}

async function BotaoNova() {
  const nova = await dadosParaNovaOportunidade();
  return <NovaOportunidadeBotao clientes={nova.clientes} fabricas={nova.fabricas} />;
}

async function IdeiasDeExpansao() {
  return <Sugestoes sugestoes={await buscarSugestoes()} />;
}

export default async function FunisPage({ searchParams }: { searchParams: Promise<{ funil?: string; fora?: string }> }) {
  const [{ funil, fora }, usuario] = await Promise.all([searchParams, obterUsuarioLogado()]);
  if (!usuario) return null; // o layout do CRM já mostra a sessão expirada
  const carteira = funil === "carteira";
  const mostrarFora = fora === "1";

  const abas = [
    { id: "prospeccao", rotulo: "Prospecção", href: "/funis" },
    { id: "carteira", rotulo: "Carteira", href: "/funis?funil=carteira" },
  ];
  const linkFora = `/funis?${new URLSearchParams({ ...(carteira ? { funil: "carteira" } : {}), ...(mostrarFora ? {} : { fora: "1" }) }).toString()}`.replace(/\?$/, "");
  const colunas: string[] = carteira
    ? [...ETAPAS_DO_QUADRO_OP, ...(mostrarFora ? ETAPAS_FORA_DO_QUADRO_OP : [])]
    : [...ETAPAS_DO_QUADRO, ...(mostrarFora ? ["PAUSADA", "DESCARTADA"] : [])];

  return (
    <PageContainer className="max-w-none">
      <PageHeader
        titulo={carteira ? "Funil da carteira" : "Funil de prospecção"}
        descricao={
          carteira
            ? "Cada cartão é um cliente e uma fábrica. Ganha sozinha quando chega o pedido."
            : "Cada cartão é uma empresa. Toda etapa em andamento pede um próximo passo com data."
        }
        acoes={
          carteira ? (
            <Suspense fallback={<Skeleton className="h-8 w-40" />}>
              <BotaoNova />
            </Suspense>
          ) : undefined
        }
      />
      <div className="-mt-2 flex flex-wrap items-end justify-between gap-x-4 gap-y-2 border-b">
        <nav aria-label="Funil" className="flex gap-1">
          {abas.map((a) => {
            const atual = (a.id === "carteira") === carteira;
            return (
              <Link
                key={a.id}
                href={a.href}
                aria-current={atual ? "page" : undefined}
                className={cn("-mb-px border-b-2 px-3 py-2.5 text-sm", atual ? "border-foreground font-semibold text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}
              >
                {a.rotulo}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-4 pb-2 text-xs text-muted-foreground">
          <span className="hidden md:inline">Arraste o cartão para mudar de etapa, ou use o menu ⋯</span>
          <span className="md:hidden">Toque em ⋯ no cartão para mudar de etapa</span>
          <Link href={linkFora} className="font-medium text-foreground underline-offset-4 hover:underline">
            {mostrarFora ? "Esconder encerradas" : carteira ? "Mostrar ganhas, adiadas e perdidas" : "Mostrar pausadas e descartadas"}
          </Link>
        </div>
      </div>
      <Suspense key={`${funil}-${fora}`} fallback={<QuadroCarregando colunas={colunas.length} />}>
        {carteira ? <FunilCarteira colunas={colunas} mostrarFora={mostrarFora} usuarioId={usuario.id} /> : <FunilProspeccao colunas={colunas} usuarioId={usuario.id} />}
      </Suspense>
      {carteira && (
        <Suspense fallback={null}>
          <IdeiasDeExpansao />
        </Suspense>
      )}
    </PageContainer>
  );
}
