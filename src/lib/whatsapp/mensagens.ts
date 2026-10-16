import { prisma } from "@/lib/prisma";
import { normalizarTelefone } from "@/domain/mensagens/telefone";
import { tipoDeEnvioSugerido, validarRascunho, type TipoEnvio } from "@/domain/mensagens/rascunho";
import { descreverMomento, quandoPodeSair, validarAgendamento } from "@/domain/mensagens/agendamento";
import { despachar, type ResultadoDoDespacho } from "./despachar";
import { lerLimites } from "./limites";
import type { TransporteWhatsapp } from "./transporte";

// O ciclo de uma mensagem nossa (ADR-015 §3): preparar (rascunho), aprovar (uma pessoa, agora ou
// com hora marcada), despachar (proteções fixas) e cancelar. As telas e o MCP chamam estas funções;
// quem chama confere a sessão ou o token. A IA nunca aprova: aprovar exige o usuário dono da sessão
// ou do token, e pelo Claude fica marcado (aprovadaPeloClaude).

export type Autor = { id: string; nome: string };
export type ResultadoDoRascunho = { erros: string[]; avisos?: string[]; id?: string; tipo?: TipoEnvio; numero?: string };
export type StatusDaAprovacao = ResultadoDoDespacho["status"] | "AGENDADA";
export type ResultadoDaAprovacao = { erros: string[]; status?: StatusDaAprovacao; motivo?: string; agendadaPara?: Date };

export const PENDENTES = ["RASCUNHO", "APROVADA"] as const;
export const JA_EXISTE_PENDENTE = "Já existe uma mensagem pendente para este contato. Edite ou cancele a anterior.";

export async function prepararRascunho(autor: Autor, entrada: { contatoId: string; texto: string; tipo?: TipoEnvio; geradaPorIa?: boolean }): Promise<ResultadoDoRascunho> {
  const contato = await prisma.contato.findUnique({ where: { id: entrada.contatoId } });
  if (!contato) return { erros: ["Contato não encontrado."] };
  if (contato.naoContatar) return { erros: ["Este contato pediu para não ser contatado. Só uma pessoa pode desfazer isso na ficha."] };
  const numero = normalizarTelefone(contato.valor);
  if (!numero) return { erros: ["O número deste contato não é um telefone válido."] };

  const existente = await prisma.conversa.findUnique({ where: { linha_numero: { linha: "PROSPECCAO", numero } } });
  if (existente?.clienteId && existente.clienteId !== contato.clienteId) return { erros: ["Este número já está ligado a outra empresa."] };

  const historico = existente
    ? await prisma.mensagem.findMany({ where: { conversaId: existente.id }, select: { direcao: true, status: true, ocorridoEm: true } })
    : [];
  if (existente && (await prisma.mensagem.count({ where: { conversaId: existente.id, direcao: "SAIDA", status: { in: [...PENDENTES] } } })) > 0) {
    return { erros: [JA_EXISTE_PENDENTE] };
  }

  const tipo = entrada.tipo ?? tipoDeEnvioSugerido(historico);
  const { erros, avisos } = validarRascunho(entrada.texto, tipo);
  if (erros.length > 0) return { erros, avisos };

  const conversa = existente
    ? existente.clienteId
      ? existente
      : await prisma.conversa.update({ where: { id: existente.id }, data: { clienteId: contato.clienteId, contatoId: contato.id, motivoSemVinculo: null } })
    : await prisma.conversa.create({
        data: { linha: "PROSPECCAO", numero, clienteId: contato.clienteId, contatoId: contato.id, ultimaMensagemEm: new Date() },
      });

  const mensagem = await prisma.mensagem.create({
    data: {
      conversaId: conversa.id,
      linha: "PROSPECCAO",
      direcao: "SAIDA",
      origem: "PLATAFORMA",
      tipo: "TEXTO",
      texto: entrada.texto.trim(),
      ocorridoEm: new Date(),
      status: "RASCUNHO",
      tipoEnvio: tipo,
      geradaPorIa: entrada.geradaPorIa ?? false,
      criadaPorId: autor.id,
    },
  });
  return { erros: [], avisos, id: mensagem.id, tipo, numero };
}

/**
 * Uma pessoa aprova. Sem hora marcada (ou com hora já passada), o despacho aplica as proteções e
 * envia ou segura. Com hora marcada, fica APROVADA até o cron achar que venceu.
 */
export async function aprovarMensagem(
  autor: Autor,
  entrada: { id: string; agendadaPara?: Date | null; peloClaude?: boolean },
  opcoes: { agora?: Date; transporte?: TransporteWhatsapp } = {},
): Promise<ResultadoDaAprovacao> {
  const agora = opcoes.agora ?? new Date();
  const m = await prisma.mensagem.findUnique({ where: { id: entrada.id } });
  if (!m || m.direcao !== "SAIDA" || m.status !== "RASCUNHO" || !m.tipoEnvio || !m.texto) return { erros: ["Só dá para aprovar um rascunho."] };

  const { erros } = validarRascunho(m.texto, m.tipoEnvio);
  if (erros.length > 0) return { erros };

  const agendada = entrada.agendadaPara && entrada.agendadaPara > agora ? entrada.agendadaPara : null;
  if (agendada) {
    const erro = validarAgendamento(agendada, agora);
    if (erro) return { erros: [erro] };
  }

  const aprovada = await prisma.mensagem.updateMany({
    where: { id: m.id, status: "RASCUNHO" },
    data: { status: "APROVADA", aprovadaPorId: autor.id, aprovadaEm: agora, agendadaPara: agendada, aprovadaPeloClaude: entrada.peloClaude ?? false, motivoBloqueio: null },
  });
  if (aprovada.count === 0) return { erros: ["Só dá para aprovar um rascunho."] };

  if (agendada) {
    const limites = await lerLimites();
    const sai = quandoPodeSair(agendada, agora, { inicio: limites.horarioInicio, fim: limites.horarioFim });
    const aviso = sai && sai.getTime() !== agendada.getTime() ? ` Fora do horário comercial: sai a partir de ${descreverMomento(sai)}.` : "";
    return { erros: [], status: "AGENDADA", agendadaPara: agendada, motivo: `Agendada para ${descreverMomento(agendada)}.${aviso}` };
  }
  const resultado = await despachar(m.id, { agora, transporte: opcoes.transporte });
  return { erros: [], status: resultado.status, motivo: resultado.motivo };
}

/** Aprovada que esperava (horário, linha, limite) ou agendada: tira o agendamento e tenta agora. */
export async function enviarAgora(id: string, opcoes: { agora?: Date; transporte?: TransporteWhatsapp } = {}): Promise<ResultadoDaAprovacao> {
  const m = await prisma.mensagem.findUnique({ where: { id } });
  if (!m || m.direcao !== "SAIDA" || m.status !== "APROVADA") return { erros: ["Esta mensagem não está aprovada."] };
  if (m.agendadaPara) await prisma.mensagem.updateMany({ where: { id, status: "APROVADA" }, data: { agendadaPara: null } });
  const resultado = await despachar(id, { agora: opcoes.agora, transporte: opcoes.transporte });
  return { erros: [], status: resultado.status, motivo: resultado.motivo };
}

export async function cancelarMensagem(autor: Autor, id: string): Promise<{ erros: string[]; clienteId?: string | null }> {
  const m = await prisma.mensagem.findUnique({ where: { id }, include: { conversa: { select: { clienteId: true } } } });
  if (!m || m.direcao !== "SAIDA" || !(PENDENTES as readonly string[]).includes(m.status)) {
    return { erros: ["Só dá para cancelar uma mensagem que ainda não foi enviada."] };
  }
  const r = await prisma.mensagem.updateMany({
    where: { id: m.id, status: { in: [...PENDENTES] } },
    data: { status: "CANCELADA", motivoBloqueio: `Cancelada por ${autor.nome}.` },
  });
  if (r.count === 0) return { erros: ["Só dá para cancelar uma mensagem que ainda não foi enviada."] };
  return { erros: [], clienteId: m.conversa.clienteId };
}
