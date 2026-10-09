import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obterUsuarioLogado } from "@/lib/sessao";
import { buscarPedidoComPermissao } from "../queries";
import { PageContainer } from "@/components/layouts/page-container";
import { StatusBadge } from "@/components/patterns/status-badge";
import { carregarNomesAuditoria } from "@/lib/auditoria-nomes";
import { descreverEvento } from "@/domain/auditoria/descricao";
import { etapasDoPedido } from "@/domain/pedido/etapas";
import { cn } from "@/lib/utils";
import { PedidoAcoes } from "./pedido-acoes";
import { PedidoDetalheTabs, type EventoLinha, type ItemLinha, type NotaLinha } from "./pedido-detalhe-tabs";
import { saldoAFaturar, valorDoPedido } from "@/domain/pedido/valor";
import { formatarReais } from "@/domain/formato/moeda";
import { Botao } from "@/components/patterns/botao";
import { FilePlus2 } from "lucide-react";

export default async function DetalhePedidoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const usuario = await obterUsuarioLogado();
  if (!usuario) notFound();

  const pedido = await buscarPedidoComPermissao(id, usuario);
  if (!pedido) notFound();

  const itensIds = pedido.itens.map((i) => i.id);
  // Histórico do pedido e dos itens dele (baixas, mudanças de status), com quem fez.
  const eventos = await prisma.eventoAuditoria.findMany({
    where: {
      OR: [
        { entidade: "Pedido", entidadeId: pedido.id },
        { entidade: "ItemPedido", entidadeId: { in: itensIds } },
      ],
    },
    include: { usuario: true },
    orderBy: { criadoEm: "desc" },
  });
  const nomes = await carregarNomesAuditoria(eventos);
  const faturamentos = await prisma.itemFaturado.findMany({
    where: { itemPedidoId: { in: itensIds } },
    include: { notaFiscal: true },
    orderBy: { notaFiscal: { dataEmissao: "asc" } },
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
    notas: faturamentos
      .filter((f) => f.itemPedidoId === item.id)
      .map((f) => ({ id: f.notaFiscal.id, numero: f.notaFiscal.numero, quantidade: f.quantidadeFaturada })),
  }));

  const notas: NotaLinha[] = notasFiscais.map(({ notaFiscal }) => ({
    id: notaFiscal.id,
    numero: notaFiscal.numero,
    chaveAcesso: notaFiscal.chaveAcesso,
    status: notaFiscal.status,
  }));

  const eventosLinha: EventoLinha[] = eventos.map((ev) => {
    const descricao = descreverEvento(ev, nomes);
    return {
      id: ev.id,
      titulo: ev.entidade === "ItemPedido" ? `${descricao.campo} · ${nomes.registros[ev.entidadeId] ?? "item"}` : descricao.campo,
      de: descricao.de,
      para: descricao.para,
      autor: ev.usuario.nome,
      criadoEm: ev.criadoEm.toISOString(),
    };
  });

  const valores = {
    estado: pedido.estado,
    valorTotalDeclarado: pedido.valorTotalDeclarado,
    itens: pedido.itens.map((i) => ({ ...i, valorUnitario: Number(i.valorUnitario) })),
  };

  return (
    <PageContainer>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold tracking-tight">Pedido {pedido.semNumero ? "S/N" : pedido.numero}</h1>
            <StatusBadge tipo="pedido" valor={pedido.estado} />
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {pedido.fabrica.nome} · {pedido.cliente.nomeFantasia}
          </p>
        </div>
        <PedidoAcoes pedidoId={pedido.id} estado={pedido.estado} />
      </div>

      <ol aria-label="Etapas do pedido" className="flex flex-wrap items-center gap-2 text-xs">
        {etapasDoPedido(pedido.estado).map((etapa, i) => (
          <li key={etapa.rotulo} className="flex items-center gap-2">
            {i > 0 && <span className="h-px w-5 bg-border" aria-hidden />}
            <span
              aria-current={etapa.situacao === "atual" ? "step" : undefined}
              className={cn(
                "rounded-md border px-2 py-0.5 font-medium",
                etapa.situacao === "atual" && "border-transparent bg-foreground text-background",
                etapa.situacao === "feita" && "text-foreground/80",
                etapa.situacao === "futura" && "text-muted-foreground",
              )}
            >
              {etapa.rotulo}
            </span>
          </li>
        ))}
      </ol>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-lg border bg-card p-4 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-xs text-muted-foreground">Valor do pedido</dt>
          <dd className="font-medium tabular-nums">{formatarReais(valorDoPedido(valores))}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Falta faturar</dt>
          <dd className="font-medium tabular-nums">{formatarReais(saldoAFaturar(valores))}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Data do pedido</dt>
          <dd>{(pedido.dataPedido ?? pedido.criadoEm).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Nº do pedido do cliente</dt>
          <dd>{pedido.numeroCliente ?? "—"}</dd>
        </div>
        {(pedido.transportadorPrevisto || pedido.vendedor || pedido.observacao) && (
          <div className="col-span-2 sm:col-span-4 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
            {pedido.transportadorPrevisto && <span>Transportadora prevista: {pedido.transportadorPrevisto}{pedido.modalidadeFrete ? ` (${pedido.modalidadeFrete})` : ""}</span>}
            {pedido.vendedor && <span>Vendedor: {pedido.vendedor}</span>}
            {pedido.observacao && <span>Obs.: {pedido.observacao}</span>}
          </div>
        )}
      </dl>

      {pedido.itens.length === 0 && (
        <div className="flex flex-col gap-3 rounded-lg border border-dashed p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground">
            Pedido registrado só pelo valor. Os itens entram quando chegar o PDF do pedido, ou sozinhos quando a nota for conferida.
          </p>
          <div className="flex shrink-0 gap-2">
            <Botao className="h-11 md:h-8" href="/pedidos/importar-pdf" icone={<FilePlus2 />}>Importar PDF</Botao>
            <Botao className="h-11 md:h-8" href="/conferencia">Conferir nota</Botao>
          </div>
        </div>
      )}

      <PedidoDetalheTabs itens={itens} notas={notas} eventos={eventosLinha} />
    </PageContainer>
  );
}
