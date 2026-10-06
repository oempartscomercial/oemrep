import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { obterUsuarioLogado } from "@/lib/sessao";
import { listarResponsaveis } from "../empresas/queries";
import { ETAPAS_DO_QUADRO } from "@/domain/crm/funil";
import { descreverPrazo, formatarDia, hojeEmSaoPaulo, situacaoDoPrazo } from "@/domain/crm/prazo";
import { PageContainer } from "@/components/layouts/page-container";
import { PageHeader } from "@/components/patterns/page-header";
import { cn } from "@/lib/utils";
import { Quadro, type CartaoFunil } from "./quadro";

export default async function FunisPage({ searchParams }: { searchParams: Promise<{ fora?: string }> }) {
  const { fora } = await searchParams;
  const mostrarFora = fora === "1";
  const usuario = await obterUsuarioLogado();
  if (!usuario) return null; // o layout do CRM já mostra a sessão expirada

  const colunas: string[] = [...ETAPAS_DO_QUADRO, ...(mostrarFora ? ["PAUSADA", "DESCARTADA"] : [])];
  const [empresas, responsaveis] = await Promise.all([
    prisma.cliente.findMany({
      where: { situacao: { in: colunas as never[] } },
      orderBy: { nomeFantasia: "asc" },
      include: {
        fabricas: { include: { fabrica: true } },
        proximosPassos: { where: { concluidoEm: null }, orderBy: { prazo: "asc" }, take: 1, include: { responsavel: true } },
      },
    }),
    listarResponsaveis(),
  ]);

  const hoje = hojeEmSaoPaulo();
  const cartoes: CartaoFunil[] = empresas.map((e) => {
    const p = e.proximosPassos[0];
    const prazo = p?.prazo.toISOString().slice(0, 10);
    return {
      id: e.id,
      nome: e.nomeFantasia,
      local: [e.cidade, e.uf].filter(Boolean).join("/"),
      situacao: e.situacao,
      fabricas: e.fabricas.map((cf) => cf.fabrica.nome),
      passo:
        p && prazo
          ? { acao: p.acao, quando: `${descreverPrazo(prazo, hoje)} · ${formatarDia(prazo)}`, atrasado: situacaoDoPrazo(prazo, hoje) === "atrasado", responsavel: p.responsavel.nome }
          : null,
      naoContatar: e.naoContatar,
    };
  });

  return (
    <PageContainer className="max-w-none">
      <PageHeader
        titulo="Funil de prospecção"
        descricao="Arraste a empresa para a etapa nova. Toda etapa em andamento pede um próximo passo com data."
        acoes={
          <Link
            href={mostrarFora ? "/funis" : "/funis?fora=1"}
            className={cn("text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline")}
          >
            {mostrarFora ? "Esconder pausadas e descartadas" : "Mostrar pausadas e descartadas"}
          </Link>
        }
      />
      <Quadro cartoes={cartoes} colunas={colunas} responsaveis={responsaveis} usuarioId={usuario.id} />
    </PageContainer>
  );
}
