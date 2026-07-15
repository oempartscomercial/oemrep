"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { obterUsuarioLogado } from "@/lib/sessao";
import { podeAcessarFabrica } from "@/lib/authz";
import { obterFabricaIdDaNotaFiscal } from "@/lib/nota-fiscal-fabrica";
import { validarAberturaChamado } from "@/domain/chamado/validacao";

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
