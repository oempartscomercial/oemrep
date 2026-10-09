"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { obterUsuarioLogado } from "@/lib/sessao";
import { podeAcessarFabrica } from "@/lib/authz";
import { obterFabricaIdDaNotaFiscal } from "@/lib/nota-fiscal-fabrica";
import { transicaoRastreioValida, type StatusRastreio } from "@/domain/nfe/rastreio";
import { compararCampos } from "@/domain/auditoria/evento";
import { registrarAlteracoes } from "@/lib/auditoria";
import { atualizarRastreioDaNota, atualizarRastreiosEmAberto } from "@/lib/rastreio/atualizar";

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

/** "Atualizar agora" de uma nota: consulta a transportadora na hora. */
export async function atualizarRastreioAgora(notaFiscalId: string): Promise<{ erros: string[]; mensagem?: string }> {
  const usuario = await obterUsuarioLogado();
  if (!usuario) return { erros: ["Sessão expirada. Faça login novamente."] };
  const fabricaId = await obterFabricaIdDaNotaFiscal(notaFiscalId);
  if (!fabricaId || !podeAcessarFabrica(usuario, fabricaId)) return { erros: ["Você não tem permissão para esta NFe."] };

  const r = await atualizarRastreioDaNota(notaFiscalId);
  revalidatePath(`/rastreio/${notaFiscalId}`);
  revalidatePath("/rastreio");
  if (r.situacao === "atualizada") {
    return { erros: [], mensagem: r.mudouStatus ? `Status atualizado: ${r.ocorrencia ?? r.status}.` : `Sem mudança. Última ocorrência: ${r.ocorrencia ?? "nenhuma"}.` };
  }
  return { erros: [], mensagem: r.motivo };
}

/** "Atualizar todas": o mesmo que o cron diário faz, sob demanda. */
export async function atualizarTodosRastreiosAgora(): Promise<{ erros: string[]; mensagem?: string }> {
  const usuario = await obterUsuarioLogado();
  if (!usuario) return { erros: ["Sessão expirada. Faça login novamente."] };
  const r = await atualizarRastreiosEmAberto(undefined, 100);
  revalidatePath("/rastreio");
  return {
    erros: [],
    mensagem: `${r.consultadas} notas consultadas · ${r.mudaramStatus} mudaram de status${r.naoEncontradas ? ` · ${r.naoEncontradas} sem resposta da transportadora` : ""}${r.falharam ? ` · ${r.falharam} com erro` : ""}.`,
  };
}
