import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { obterUsuarioLogado } from "@/lib/sessao";
import { listarResponsaveis } from "../empresas/queries";
import { buscarCarteira, buscarSugestoes, dadosParaNovaOportunidade } from "./queries";
import { ETAPAS_DO_QUADRO } from "@/domain/crm/funil";
import { ETAPAS_DO_QUADRO_OP, ETAPAS_FORA_DO_QUADRO_OP } from "@/domain/crm/oportunidade";
import { descreverPrazo, formatarDia, hojeEmSaoPaulo, situacaoDoPrazo } from "@/domain/crm/prazo";
import { PageContainer } from "@/components/layouts/page-container";
import { PageHeader } from "@/components/patterns/page-header";
import { cn } from "@/lib/utils";
import { Quadro, type CartaoFunil } from "./quadro";
import { QuadroCarteira, type CartaoCarteira } from "./quadro-carteira";
import { Sugestoes } from "./sugestoes";
import { NovaOportunidadeBotao } from "./nova-oportunidade-botao";

type Passo = { acao: string; prazo: Date; responsavel: { nome: string } };

function resumirPasso(p: Passo | undefined, hoje: string) {
  if (!p) return null;
  const prazo = p.prazo.toISOString().slice(0, 10);
  return { acao: p.acao, quando: `${descreverPrazo(prazo, hoje)} · ${formatarDia(prazo)}`, atrasado: situacaoDoPrazo(prazo, hoje) === "atrasado", responsavel: p.responsavel.nome };
}

export default async function FunisPage({ searchParams }: { searchParams: Promise<{ funil?: string; fora?: string }> }) {
  const { funil, fora } = await searchParams;
  const carteira = funil === "carteira";
  const mostrarFora = fora === "1";
  const usuario = await obterUsuarioLogado();
  if (!usuario) return null; // o layout do CRM já mostra a sessão expirada
  const hoje = hojeEmSaoPaulo();
  const responsaveis = await listarResponsaveis();

  const abas = [
    { id: "prospeccao", rotulo: "Prospecção", href: "/funis" },
    { id: "carteira", rotulo: "Carteira", href: "/funis?funil=carteira" },
  ];
  const linkFora = `/funis?${new URLSearchParams({ ...(carteira ? { funil: "carteira" } : {}), ...(mostrarFora ? {} : { fora: "1" }) }).toString()}`.replace(/\?$/, "");

  const cabecalho = (titulo: string, descricao: string, acoes?: React.ReactNode) => (
    <>
      <PageHeader
        titulo={titulo}
        descricao={descricao}
        acoes={
          <>
            <Link href={linkFora} className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
              {mostrarFora ? "Esconder as de fora do quadro" : carteira ? "Mostrar ganhas, adiadas e perdidas" : "Mostrar pausadas e descartadas"}
            </Link>
            {acoes}
          </>
        }
      />
      <nav aria-label="Funil" className="-mt-2 flex gap-1 border-b">
        {abas.map((a) => (
          <Link
            key={a.id}
            href={a.href}
            aria-current={(a.id === "carteira") === carteira ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm",
              (a.id === "carteira") === carteira ? "border-foreground font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {a.rotulo}
          </Link>
        ))}
      </nav>
    </>
  );

  if (carteira) {
    const colunas: string[] = [...ETAPAS_DO_QUADRO_OP, ...(mostrarFora ? ETAPAS_FORA_DO_QUADRO_OP : [])];
    const [oportunidades, nova, sugestoes] = await Promise.all([buscarCarteira(mostrarFora), dadosParaNovaOportunidade(), buscarSugestoes()]);
    const cartoes: CartaoCarteira[] = oportunidades.map((o) => ({
      id: o.id,
      clienteId: o.clienteId,
      cliente: o.cliente.nomeFantasia,
      fabrica: o.fabrica.nome,
      tipo: o.tipo,
      etapa: o.etapa,
      motivoPerda: o.motivoPerda,
      passo: resumirPasso(o.proximosPassos[0], hoje),
    }));
    return (
      <PageContainer className="max-w-none">
        {cabecalho(
          "Funil da carteira",
          "Cada cartão é um cliente e uma fábrica. Ganha sozinha quando chega o pedido.",
          <NovaOportunidadeBotao clientes={nova.clientes} fabricas={nova.fabricas} />,
        )}
        <QuadroCarteira cartoes={cartoes} colunas={colunas} responsaveis={responsaveis} usuarioId={usuario.id} />
        <Sugestoes sugestoes={sugestoes} />
      </PageContainer>
    );
  }

  const colunas: string[] = [...ETAPAS_DO_QUADRO, ...(mostrarFora ? ["PAUSADA", "DESCARTADA"] : [])];
  const empresas = await prisma.cliente.findMany({
    where: { situacao: { in: colunas as never[] } },
    orderBy: { nomeFantasia: "asc" },
    include: {
      fabricas: { include: { fabrica: true } },
      proximosPassos: { where: { concluidoEm: null, oportunidadeId: null }, orderBy: { prazo: "asc" }, take: 1, include: { responsavel: true } },
    },
  });
  const cartoes: CartaoFunil[] = empresas.map((e) => ({
    id: e.id,
    nome: e.nomeFantasia,
    local: [e.cidade, e.uf].filter(Boolean).join("/"),
    situacao: e.situacao,
    fabricas: e.fabricas.map((cf) => cf.fabrica.nome),
    passo: resumirPasso(e.proximosPassos[0], hoje),
    naoContatar: e.naoContatar,
  }));

  return (
    <PageContainer className="max-w-none">
      {cabecalho("Funil de prospecção", "Arraste a empresa para a etapa nova. Toda etapa em andamento pede um próximo passo com data.")}
      <Quadro cartoes={cartoes} colunas={colunas} responsaveis={responsaveis} usuarioId={usuario.id} />
    </PageContainer>
  );
}
