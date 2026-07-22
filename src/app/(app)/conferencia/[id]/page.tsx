import { notFound } from "next/navigation";
import { AlertTriangle } from "@untitledui/icons";
import { prisma } from "@/lib/prisma";
import { obterUsuarioLogado } from "@/lib/sessao";
import { podeAcessarFabrica } from "@/lib/authz";
import { obterFabricaIdDaNotaFiscal } from "@/lib/nota-fiscal-fabrica";
import { agruparCruzamentoPorPedido, type LinhaFaturamento } from "@/domain/nfe/relatorio";
import { PageContainer } from "@/components/layouts/page-container";
import { Button } from "@/components/ui/buttons/button";
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
      <div className="flex flex-col gap-4 border-b border-secondary pb-5 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-display-xs font-semibold text-primary">Cruzamento — NFe {notaFiscal.numero}</h1>
          <p className="text-sm text-tertiary">Chave: {notaFiscal.chaveAcesso}</p>
        </div>
        <Button color="secondary" href={`/divergencias/nova?notaFiscalId=${notaFiscal.id}`} iconLeading={<AlertTriangle />}>
          Abrir chamado
        </Button>
      </div>

      <CruzamentoRelatorio grupos={grupos} />
    </PageContainer>
  );
}
