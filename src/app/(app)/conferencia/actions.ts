"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { obterUsuarioLogado } from "@/lib/sessao";
import { podeAcessarFabrica } from "@/lib/authz";
import { extrairNFeDoXml, type NFeExtraida } from "@/domain/nfe/parser";
import { conferirItens, type PendenciaItem, type ResultadoConferenciaItem } from "@/domain/nfe/conferencia";
import { validarVinculoPedidos } from "@/domain/nfe/vinculo";
import { aplicarBaixaItem } from "@/domain/nfe/baixa";
import { calcularQtdPendente } from "@/domain/pedido/item";
import { recalcularEstado } from "@/domain/pedido/estado";
import { compararCampos } from "@/domain/auditoria/evento";
import { registrarAlteracoes } from "@/lib/auditoria";

export type AnaliseNFe = {
  nfe: NFeExtraida;
  clienteId: string | null;
  fabricaId: string | null;
  conferencia: ResultadoConferenciaItem[];
};

export async function analisarXmlNFe(formData: FormData): Promise<{ erro?: string; analise?: AnaliseNFe }> {
  const arquivo = formData.get("arquivo") as File | null;
  if (!arquivo || arquivo.size === 0) return { erro: "Selecione um arquivo XML." };

  let nfe: NFeExtraida;
  try {
    nfe = extrairNFeDoXml(await arquivo.text());
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : "Falha ao ler o XML." };
  }

  const existente = await prisma.notaFiscal.findUnique({ where: { chaveAcesso: nfe.chaveAcesso } });
  if (existente) return { erro: "Esta NFe já foi importada." };

  const [cliente, fabrica] = await Promise.all([
    prisma.cliente.findUnique({ where: { cnpj: nfe.destinatarioCnpj } }),
    prisma.fabrica.findUnique({ where: { cnpj: nfe.emitenteCnpj } }),
  ]);

  if (!cliente || !fabrica) {
    return { analise: { nfe, clienteId: cliente?.id ?? null, fabricaId: fabrica?.id ?? null, conferencia: [] } };
  }

  const pedidos = await prisma.pedido.findMany({
    where: { clienteId: cliente.id, fabricaId: fabrica.id, estado: { in: ["SEM_NFE", "PARCIAL"] } },
    include: { itens: { where: { status: "PENDENTE" } } },
  });

  const pendencias: PendenciaItem[] = pedidos.flatMap((pedido) =>
    pedido.itens.map((item) => ({
      itemPedidoId: item.id,
      pedidoId: pedido.id,
      clienteCnpj: cliente.cnpj,
      referencia: item.referencia,
      quantidadePendente: calcularQtdPendente({
        quantidadePedida: item.quantidadePedida,
        quantidadeFaturada: item.quantidadeFaturada,
      }),
      valorUnitario: Number(item.valorUnitario),
    })),
  );

  const conferencia = conferirItens(nfe.destinatarioCnpj, nfe.itens, pendencias);

  return { analise: { nfe, clienteId: cliente.id, fabricaId: fabrica.id, conferencia } };
}

export async function confirmarBaixaNFe(analise: AnaliseNFe): Promise<{ erros: string[] }> {
  const usuario = await obterUsuarioLogado();
  if (!usuario) return { erros: ["Sessão expirada. Faça login novamente."] };
  if (!analise.clienteId || !analise.fabricaId) {
    return { erros: ["Fábrica ou cliente não cadastrado para esta NFe."] };
  }

  if (!podeAcessarFabrica(usuario, analise.fabricaId)) {
    return { erros: ["Você não tem permissão para confirmar baixas nesta fábrica."] };
  }

  const vinculados = analise.conferencia.filter((r) => r.pendencia !== null);
  if (vinculados.length === 0) return { erros: ["Nenhum item da NFe corresponde a um pedido pendente."] };

  const pedidosIds = [...new Set(vinculados.map((r) => r.pendencia!.pedidoId))];
  const erros = validarVinculoPedidos(pedidosIds.map((id) => ({ id, clienteId: analise.clienteId! })));
  if (erros.length > 0) return { erros };

  const notaFiscal = await prisma.notaFiscal.create({
    data: {
      numero: analise.nfe.numero,
      chaveAcesso: analise.nfe.chaveAcesso,
      emitenteCnpj: analise.nfe.emitenteCnpj,
      destinatarioCnpj: analise.nfe.destinatarioCnpj,
      dataEmissao: new Date(analise.nfe.dataEmissao),
      totalProdutos: analise.nfe.totalProdutos,
      totalNota: analise.nfe.totalNota,
      pedidos: { create: pedidosIds.map((pedidoId) => ({ pedidoId })) },
    },
  });

  for (const resultado of vinculados) {
    const pendencia = resultado.pendencia!;
    const item = await prisma.itemPedido.findUnique({ where: { id: pendencia.itemPedidoId } });
    if (!item) continue;

    const { quantidadeFaturada, status } = aplicarBaixaItem(item, resultado.itemNFe.quantidade);

    await prisma.itemFaturado.create({
      data: { itemPedidoId: item.id, notaFiscalId: notaFiscal.id, quantidadeFaturada: resultado.itemNFe.quantidade },
    });
    await prisma.itemPedido.update({ where: { id: item.id }, data: { quantidadeFaturada, status } });
    await registrarAlteracoes(
      compararCampos(
        "ItemPedido",
        item.id,
        usuario.id,
        { quantidadeFaturada: item.quantidadeFaturada, status: item.status },
        { quantidadeFaturada, status },
      ),
    );
  }

  for (const pedidoId of pedidosIds) {
    const pedido = await prisma.pedido.findUnique({ where: { id: pedidoId }, include: { itens: true } });
    if (!pedido) continue;

    // ADR-008: o pedido só sai de SEM_NFE quando a 1ª NFe é vinculada. A partir daí,
    // recalcularEstado decide entre PARCIAL/COMPLETO olhando só os itens (ADR-005).
    const baseParaRecalculo = pedido.estado === "SEM_NFE" ? "PARCIAL" : pedido.estado;
    const novoEstado = recalcularEstado(baseParaRecalculo, pedido.itens);

    if (novoEstado !== pedido.estado) {
      await prisma.pedido.update({ where: { id: pedidoId }, data: { estado: novoEstado } });
      await registrarAlteracoes(
        compararCampos("Pedido", pedidoId, usuario.id, { estado: pedido.estado }, { estado: novoEstado }),
      );
    }
    revalidatePath(`/pedidos/${pedidoId}`);
  }

  await registrarAlteracoes(
    compararCampos(
      "NotaFiscal",
      notaFiscal.id,
      usuario.id,
      {},
      { chaveAcesso: notaFiscal.chaveAcesso, numero: notaFiscal.numero },
    ),
  );

  revalidatePath("/pedidos");
  return { erros: [] };
}
