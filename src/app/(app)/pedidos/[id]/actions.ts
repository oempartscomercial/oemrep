"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { obterUsuarioLogado } from "@/lib/sessao";
import { recalcularEstado, transicaoValida, type StatusItemPedido } from "@/domain/pedido/estado";
import { calcularQtdPendente, deveCongelarPendencia } from "@/domain/pedido/item";
import { compararCampos } from "@/domain/auditoria/evento";
import { registrarAlteracoes } from "@/lib/auditoria";

export async function atualizarStatusItem(
  itemId: string,
  novoStatus: StatusItemPedido,
  observacao: string,
): Promise<{ erros: string[] }> {
  const usuario = await obterUsuarioLogado();
  if (!usuario) return { erros: ["Sessão expirada. Faça login novamente."] };

  const item = await prisma.itemPedido.findUnique({
    where: { id: itemId },
    include: { pedido: { include: { itens: true } } },
  });
  if (!item) return { erros: ["Item não encontrado."] };

  const congelar = deveCongelarPendencia(item.status, novoStatus);
  const qtdPendenteCongelada = congelar
    ? calcularQtdPendente({
        quantidadePedida: item.quantidadePedida,
        quantidadeFaturada: item.quantidadeFaturada,
      })
    : item.qtdPendenteCongelada;

  await prisma.itemPedido.update({
    where: { id: itemId },
    data: { status: novoStatus, observacao, qtdPendenteCongelada },
  });

  const itensAtualizados = item.pedido.itens.map((i) =>
    i.id === itemId ? { ...i, status: novoStatus } : i,
  );
  const novoEstadoPedido = recalcularEstado(item.pedido.estado, itensAtualizados);

  if (novoEstadoPedido !== item.pedido.estado) {
    await prisma.pedido.update({
      where: { id: item.pedido.id },
      data: { estado: novoEstadoPedido },
    });
  }

  await registrarAlteracoes(
    compararCampos("ItemPedido", itemId, usuario.id, { status: item.status }, { status: novoStatus }),
  );

  revalidatePath(`/pedidos/${item.pedido.id}`);
  return { erros: [] };
}

async function mudarEstadoPedido(pedidoId: string, novoEstado: "ARQUIVADO" | "COMPLETO"): Promise<{ erros: string[] }> {
  const usuario = await obterUsuarioLogado();
  if (!usuario) return { erros: ["Sessão expirada. Faça login novamente."] };

  const pedido = await prisma.pedido.findUnique({ where: { id: pedidoId } });
  if (!pedido) return { erros: ["Pedido não encontrado."] };

  if (!transicaoValida(pedido.estado, novoEstado)) {
    return { erros: [`Não é possível mudar de ${pedido.estado} para ${novoEstado}.`] };
  }

  await prisma.pedido.update({ where: { id: pedidoId }, data: { estado: novoEstado } });

  await registrarAlteracoes(
    compararCampos("Pedido", pedidoId, usuario.id, { estado: pedido.estado }, { estado: novoEstado }),
  );

  revalidatePath(`/pedidos/${pedidoId}`);
  revalidatePath("/pedidos");
  return { erros: [] };
}

// RF10: arquivamento é reversível — arquivar só é válido a partir de COMPLETO.
export async function arquivarPedido(pedidoId: string): Promise<{ erros: string[] }> {
  return mudarEstadoPedido(pedidoId, "ARQUIVADO");
}

export async function reabrirPedido(pedidoId: string): Promise<{ erros: string[] }> {
  return mudarEstadoPedido(pedidoId, "COMPLETO");
}
