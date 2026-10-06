import { notFound } from "next/navigation";
import { TriangleAlert } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { obterUsuarioLogado } from "@/lib/sessao";
import { podeAcessarFabrica } from "@/lib/authz";
import { obterFabricaIdDaNotaFiscal } from "@/lib/nota-fiscal-fabrica";
import { agruparCruzamentoPorPedido, type LinhaFaturamento } from "@/domain/nfe/relatorio";
import { PageContainer } from "@/components/layouts/page-container";
import { PageHeader } from "@/components/patterns/page-header";
import { Botao } from "@/components/patterns/botao";
import { CruzamentoRelatorio } from "./cruzamento-relatorio";

export default async function RelatorioCruzamentoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const usuario = await obterUsuarioLogado();
  if (!usuario) notFound();

  const notaFiscal = await prisma.notaFiscal.findUnique({
    where: { id },
    include: { itensFaturados: { include: { itemPedido: { include: { pedido: true } } } } },
  });
  if (!notaFiscal) notFound();

  const fabricaId = await obterFabricaIdDaNotaFiscal(id);
  if (!fabricaId || !podeAcessarFabrica(usuario, fabricaId)) notFound();

  const linhas: LinhaFaturamento[] = notaFiscal.itensFaturados.map((faturado) => ({
    pedidoId: faturado.itemPedido.pedidoId,
    pedidoNumero: faturado.itemPedido.pedido.semNumero
      ? "S/N"
      : (faturado.itemPedido.pedido.numero ?? "S/N"),
    referencia: faturado.itemPedido.referencia,
    descricao: faturado.itemPedido.descricao,
    quantidadeFaturada: faturado.quantidadeFaturada,
    valorUnitario: Number(faturado.itemPedido.valorUnitario),
  }));

  const grupos = agruparCruzamentoPorPedido(linhas);

  return (
    <PageContainer>
      <PageHeader
        titulo={`Cruzamento — NFe ${notaFiscal.numero}`}
        descricao={`Chave: ${notaFiscal.chaveAcesso}`}
        acoes={
          <Botao variante="secundario" href={`/divergencias/nova?notaFiscalId=${notaFiscal.id}`} icone={<TriangleAlert />}>
            Abrir chamado
          </Botao>
        }
      />

      <CruzamentoRelatorio grupos={grupos} />
    </PageContainer>
  );
}
