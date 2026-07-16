"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { obterUsuarioLogado } from "@/lib/sessao";
import { podeAcessarFabrica } from "@/lib/authz";
import { obterFabricaIdDaNotaFiscal } from "@/lib/nota-fiscal-fabrica";
import { validarAberturaChamado } from "@/domain/chamado/validacao";
import { transicaoChamadoValida, type EstadoChamado } from "@/domain/chamado/estado";

export async function abrirChamado(formData: FormData): Promise<{ erros: string[]; chamadoId?: string }> {
  const notaFiscalId = String(formData.get("notaFiscalId") ?? "");
  const motivoId = String(formData.get("motivoId") ?? "");
  const observacao = String(formData.get("observacao") ?? "");
  const itensAfetadosIds = formData.getAll("itemPedidoId").map(String);

  const erros = validarAberturaChamado({ notaFiscalId, motivoId, observacao, itensAfetadosIds });
  if (erros.length > 0) return { erros };

  const usuario = await obterUsuarioLogado();
  if (!usuario) return { erros: ["Sessão expirada. Faça login novamente."] };

  const fabricaId = await obterFabricaIdDaNotaFiscal(notaFiscalId);
  if (!fabricaId || !podeAcessarFabrica(usuario, fabricaId)) {
    return { erros: ["Você não tem permissão para abrir chamados para esta NFe."] };
  }

  const motivo = await prisma.motivoChamado.findUnique({ where: { id: motivoId } });
  if (!motivo) return { erros: ["Motivo inválido."] };

  const itensFaturados = await prisma.itemFaturado.findMany({
    where: { notaFiscalId },
    select: { itemPedidoId: true },
  });
  const itemPedidoIdsValidos = new Set(itensFaturados.map((item) => item.itemPedidoId));
  const algumItemNaoPertenceANota = itensAfetadosIds.some((id) => !itemPedidoIdsValidos.has(id));
  if (algumItemNaoPertenceANota) {
    return { erros: ["Um ou mais itens selecionados não pertencem a esta NFe."] };
  }

  const chamado = await prisma.chamado.create({
    data: {
      notaFiscalId,
      motivoId,
      abertoPorId: usuario.id,
      itensAfetados: { create: itensAfetadosIds.map((itemPedidoId) => ({ itemPedidoId })) },
      eventos: {
        create: [
          {
            estado: "ABERTO",
            estadoAnterior: null,
            observacao: observacao.trim(),
            usuarioId: usuario.id,
          },
        ],
      },
    },
  });

  revalidatePath("/divergencias");
  return { erros: [], chamadoId: chamado.id };
}

export async function registrarEventoChamado(
  chamadoId: string,
  novoEstado: EstadoChamado,
  observacao: string,
): Promise<{ erros: string[] }> {
  const usuario = await obterUsuarioLogado();
  if (!usuario) return { erros: ["Sessão expirada. Faça login novamente."] };

  const chamado = await prisma.chamado.findUnique({ where: { id: chamadoId } });
  if (!chamado) return { erros: ["Chamado não encontrado."] };

  const fabricaId = await obterFabricaIdDaNotaFiscal(chamado.notaFiscalId);
  if (!fabricaId || !podeAcessarFabrica(usuario, fabricaId)) {
    return { erros: ["Você não tem permissão para atualizar este chamado."] };
  }

  const estadoAtual = chamado.estado as EstadoChamado;
  if (!transicaoChamadoValida(estadoAtual, novoEstado)) {
    return { erros: [`Não é possível mudar o chamado de ${estadoAtual} para ${novoEstado}.`] };
  }

  if (!observacao.trim()) {
    return { erros: ["Descreva o andamento (observação obrigatória)."] };
  }

  await prisma.eventoChamado.create({
    data: {
      chamadoId: chamado.id,
      estadoAnterior: estadoAtual,
      estado: novoEstado,
      observacao: observacao.trim(),
      usuarioId: usuario.id,
    },
  });
  await prisma.chamado.update({ where: { id: chamado.id }, data: { estado: novoEstado } });

  revalidatePath(`/divergencias/${chamado.id}`);
  revalidatePath("/divergencias");
  return { erros: [] };
}
