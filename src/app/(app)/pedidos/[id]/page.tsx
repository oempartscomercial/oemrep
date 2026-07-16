import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obterUsuarioLogado } from "@/lib/sessao";
import { buscarPedidoComPermissao } from "../queries";
import { PageContainer } from "@/components/layouts/page-container";
import { StatusBadge } from "@/components/patterns/status-badge";
import { PedidoAcoes } from "./pedido-acoes";
import { PedidoDetalheTabs, type EventoLinha, type ItemLinha, type NotaLinha } from "./pedido-detalhe-tabs";

export default async function DetalhePedidoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const usuario = await obterUsuarioLogado();
  if (!usuario) notFound();

  const pedido = await buscarPedidoComPermissao(id, usuario);
  if (!pedido) notFound();

  const eventos = await prisma.eventoAuditoria.findMany({
    where: { entidade: "Pedido", entidadeId: pedido.id },
    orderBy: { criadoEm: "desc" },
  });

  const notasFiscais = await prisma.notaFiscalPedido.findMany({
    where: { pedidoId: pedido.id },
    include: { notaFiscal: true },
    orderBy: { notaFiscal: { criadoEm: "desc" } },
  });

  const itens: ItemLinha[] = pedido.itens.map((item) => ({
    id: item.id,
    referencia: item.referencia,
    descricao: item.descricao ?? "",
    quantidadePedida: Number(item.quantidadePedida),
    quantidadeFaturada: Number(item.quantidadeFaturada),
    status: item.status,
    observacao: item.observacao ?? "",
  }));

  const notas: NotaLinha[] = notasFiscais.map(({ notaFiscal }) => ({
    id: notaFiscal.id,
    numero: notaFiscal.numero,
    chaveAcesso: notaFiscal.chaveAcesso,
    status: notaFiscal.status,
  }));

  const eventosLinha: EventoLinha[] = eventos.map((ev) => ({
    id: ev.id,
    campo: ev.campo,
    valorAnterior: ev.valorAnterior,
    valorNovo: ev.valorNovo,
    criadoEm: ev.criadoEm.toISOString(),
  }));

  return (
    <PageContainer>
      <div className="flex flex-col gap-4 border-b border-secondary pb-5 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <h1 className="text-display-xs font-semibold text-primary">Pedido {pedido.semNumero ? "S/N" : pedido.numero}</h1>
            <StatusBadge tipo="pedido" valor={pedido.estado} size="md" />
          </div>
          <p className="text-md text-tertiary">
            {pedido.fabrica.nome} · {pedido.cliente.nomeFantasia}
          </p>
        </div>
        <PedidoAcoes pedidoId={pedido.id} estado={pedido.estado} />
      </div>

      <PedidoDetalheTabs itens={itens} notas={notas} eventos={eventosLinha} />
    </PageContainer>
  );
}
