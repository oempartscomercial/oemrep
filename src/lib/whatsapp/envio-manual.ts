import { prisma } from "@/lib/prisma";
import { bloqueiosDoEnvioManual } from "@/domain/mensagens/envio-manual";
import { aplicarEfeitosDoEnvio, type EnvioManual } from "./efeitos";
import { JA_SAIU, lerLimites } from "./despachar";

// "Já enviei": a mensagem aprovada saiu pelo WhatsApp do celular de prospecção, não pelo
// transporte. Grava como enviada à mão e aplica no CRM o mesmo que um envio automático.
// Depois disso ela não está mais APROVADA, então o envio agendado nunca a reenvia.

export type ResultadoDoEnvioManual = { ok: true; clienteId: string | null } | { ok: false; motivo: string };

export const SO_APROVADA = "Só dá para marcar como enviada uma mensagem aprovada que ainda não saiu.";
const JA_FOI = (m: { status: string; envioManual: boolean }) => m.envioManual && (JA_SAIU as readonly string[]).includes(m.status);

export async function registrarEnvioManual(mensagemId: string, quem: EnvioManual, agora: Date = new Date()): Promise<ResultadoDoEnvioManual> {
  const m = await prisma.mensagem.findUnique({ where: { id: mensagemId }, include: { conversa: { include: { cliente: true, contato: true } } } });
  if (!m || m.direcao !== "SAIDA") return { ok: false, motivo: SO_APROVADA };
  const clienteId = m.conversa.clienteId;
  // Segundo toque: já está registrada, não repete nada.
  if (JA_FOI(m)) return { ok: true, clienteId };
  if (m.status !== "APROVADA") return { ok: false, motivo: SO_APROVADA };

  const { cliente, contato } = m.conversa;
  if (!cliente || !contato || !m.tipoEnvio || !m.texto) return { ok: false, motivo: "A mensagem não está ligada a um contato cadastrado." };

  const [historico, limites] = await Promise.all([
    prisma.mensagem.findMany({ where: { conversaId: m.conversaId, id: { not: m.id } }, select: { direcao: true, status: true, texto: true, ocorridoEm: true } }),
    lerLimites(),
  ]);
  const bloqueios = bloqueiosDoEnvioManual({
    agora,
    tipo: m.tipoEnvio,
    texto: m.texto,
    empresa: { situacao: cliente.situacao, naoContatar: cliente.naoContatar },
    contato: { naoContatar: contato.naoContatar, origemContato: contato.origemContato },
    numero: m.conversa.numero,
    historico,
    limites,
  });
  if (bloqueios.length > 0) return { ok: false, motivo: `Não dá para marcar como enviada: ${bloqueios.map((b) => b.texto).join(" ")}` };

  // Marca e aplica os efeitos juntos. Só quem tirou a mensagem de APROVADA aplica os efeitos:
  // dois toques ao mesmo tempo (ou o envio automático no meio) não repetem nada.
  const marcou = await prisma.$transaction(async (tx) => {
    const r = await tx.mensagem.updateMany({
      where: { id: m.id, status: "APROVADA" },
      data: { status: "ENVIADA", enviadaEm: agora, ocorridoEm: agora, envioManual: true, enviadaPorId: quem.usuarioId, motivoBloqueio: null, erro: null },
    });
    if (r.count === 0) return false;
    await aplicarEfeitosDoEnvio(tx, m.id, agora, limites.diasEntreMensagens, quem);
    return true;
  });
  if (marcou) return { ok: true, clienteId };

  const agoraEsta = await prisma.mensagem.findUniqueOrThrow({ where: { id: m.id }, select: { status: true, envioManual: true } });
  return JA_FOI(agoraEsta) ? { ok: true, clienteId } : { ok: false, motivo: SO_APROVADA };
}
