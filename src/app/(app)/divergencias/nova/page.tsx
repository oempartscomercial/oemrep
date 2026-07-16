import { notFound } from "next/navigation";
import { obterUsuarioLogado } from "@/lib/sessao";
import { buscarContextoAberturaChamado } from "../queries";
import { PageContainer } from "@/components/layouts/page-container";
import { PageHeader } from "@/components/patterns/page-header";
import { ChamadoForm } from "./chamado-form";

export default async function NovoChamadoPage({
  searchParams,
}: {
  searchParams: Promise<{ notaFiscalId?: string }>;
}) {
  const { notaFiscalId } = await searchParams;
  if (!notaFiscalId) notFound();

  const usuario = await obterUsuarioLogado();
  if (!usuario) notFound();

  const contexto = await buscarContextoAberturaChamado(notaFiscalId, usuario);
  if (!contexto) notFound();

  const itensDisponiveis = contexto.notaFiscal.itensFaturados.map((faturado) => ({
    itemPedidoId: faturado.itemPedidoId,
    referencia: faturado.itemPedido.referencia,
    descricao: faturado.itemPedido.descricao,
    pedidoNumero: faturado.itemPedido.pedido.semNumero
      ? "S/N"
      : (faturado.itemPedido.pedido.numero ?? "S/N"),
  }));

  return (
    <PageContainer>
      <PageHeader titulo={`Abrir chamado — NFe ${contexto.notaFiscal.numero}`} descricao="Registre uma divergência sobre esta nota fiscal." />
      <ChamadoForm
        notaFiscalId={contexto.notaFiscal.id}
        motivos={contexto.motivos}
        itensDisponiveis={itensDisponiveis}
      />
    </PageContainer>
  );
}
