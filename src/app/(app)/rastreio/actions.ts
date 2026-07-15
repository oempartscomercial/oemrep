"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { obterUsuarioLogado } from "@/lib/sessao";
import { podeAcessarFabrica } from "@/lib/authz";
import { obterFabricaIdDaNotaFiscal } from "@/lib/nota-fiscal-fabrica";
import { transicaoRastreioValida, type StatusRastreio } from "@/domain/nfe/rastreio";
import { compararCampos } from "@/domain/auditoria/evento";
import { registrarAlteracoes } from "@/lib/auditoria";

export async function avancarRastreio(
  notaFiscalId: string,
  novoStatus: StatusRastreio,
  observacao: string,
  dataEvento: string,
): Promise<{ erros: string[] }> {
  const usuario = await obterUsuarioLogado();
  if (!usuario) return { erros: ["Sessão expirada. Faça login novamente."] };

  const nota = await prisma.notaFiscal.findUnique({ where: { id: notaFiscalId } });
  if (!nota) return { erros: ["NFe não encontrada."] };

  const fabricaId = await obterFabricaIdDaNotaFiscal(notaFiscalId);
  if (!fabricaId || !podeAcessarFabrica(usuario, fabricaId)) {
    return { erros: ["Você não tem permissão para atualizar o rastreio desta NFe."] };
  }

  const statusAtual = nota.status as StatusRastreio;
  if (!transicaoRastreioValida(statusAtual, novoStatus)) {
    return { erros: [`Não é possível mudar o rastreio de ${statusAtual} para ${novoStatus}.`] };
  }

  const data = new Date(dataEvento);
  if (Number.isNaN(data.getTime())) {
    return { erros: ["Data do evento inválida."] };
  }

  await prisma.eventoRastreio.create({
    data: {
      notaFiscalId: nota.id,
      statusAnterior: statusAtual,
      status: novoStatus,
      observacao: observacao.trim() || null,
      dataEvento: data,
      usuarioId: usuario.id,
    },
  });

  await prisma.notaFiscal.update({ where: { id: nota.id }, data: { status: novoStatus } });

  await registrarAlteracoes(
    compararCampos("NotaFiscal", nota.id, usuario.id, { status: statusAtual }, { status: novoStatus }),
  );

  revalidatePath(`/rastreio/${nota.id}`);
  revalidatePath("/rastreio");
  return { erros: [] };
}
