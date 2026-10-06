import { dentroDoHorarioComercial } from "./horario";
import type { TipoEnvio } from "./rascunho";

// Proteções fixas antes de qualquer envio (ADR-015 §4). A IA não decide nada disto.
// Cada bloqueio diz se é de espera (horário, linha, limite do dia: resolve sozinho) ou
// definitivo (a mensagem não deve sair nunca neste estado).

export type Bloqueio = { codigo: string; texto: string; espera: boolean };
export type ResultadoDaVerificacao = { ok: true } | { ok: false; bloqueios: Bloqueio[] };

export type Limites = {
  horarioInicio: number;
  horarioFim: number;
  maxPrimeirosPorDia: number;
  diasEntreMensagens: number;
  maxTentativas: number;
};

export type MensagemDoHistorico = { direcao: "ENTRADA" | "SAIDA"; status: string; texto: string | null; ocorridoEm: Date };

export type ContextoDeEnvio = {
  agora: Date;
  tipo: TipoEnvio;
  texto: string;
  empresa: { situacao: string; naoContatar: boolean };
  contato: { naoContatar: boolean; origemContato: string | null };
  /** Telefone do contato em E.164; nulo = o valor cadastrado não é um telefone. */
  numero: string | null;
  /** Conversa com este número, sem a mensagem em análise. */
  historico: MensagemDoHistorico[];
  primeirosContatosHoje: number;
  limites: Limites;
  linha: "conectada" | "desconectada" | "desconhecida";
};

const SITUACOES_QUE_RECEBEM = new Set(["APROVADA", "EM_CONTATO", "CONVERSANDO", "AVANCO"]);
const SITUACAO_BLOQUEADA: Record<string, { codigo: string; texto: string }> = {
  CANDIDATA: { codigo: "empresa_nao_aprovada", texto: "A empresa ainda não foi aprovada para abordagem." },
  DESCARTADA: { codigo: "empresa_descartada", texto: "A empresa foi descartada." },
  PAUSADA: { codigo: "empresa_pausada", texto: "A empresa está pausada." },
  CLIENTE: { codigo: "cliente_atual", texto: "Cliente atual não recebe mensagens pela linha de prospecção." },
};

const DIA_MS = 86_400_000;
// Só o que de fato saiu conta como conversa: rascunho, falha e cancelada não.
const SAIU = new Set(["ENVIANDO", "ENVIADA", "ENTREGUE", "LIDA"]);
const igual = (a: string | null, b: string) => (a ?? "").trim().replace(/\s+/g, " ") === b.trim().replace(/\s+/g, " ");

export function verificarEnvio(c: ContextoDeEnvio): ResultadoDaVerificacao {
  const bloqueios: Bloqueio[] = [];
  const definitivo = (codigo: string, texto: string) => bloqueios.push({ codigo, texto, espera: false });
  const espera = (codigo: string, texto: string) => bloqueios.push({ codigo, texto, espera: true });

  if (c.contato.naoContatar || c.empresa.naoContatar) definitivo("nao_contatar", "Esta empresa ou este contato pediu para não ser contatado.");
  if (!SITUACOES_QUE_RECEBEM.has(c.empresa.situacao)) {
    const b = SITUACAO_BLOQUEADA[c.empresa.situacao] ?? { codigo: "empresa_fora_do_funil", texto: "A empresa não está em prospecção." };
    definitivo(b.codigo, b.texto);
  }
  if (!c.contato.origemContato) definitivo("sem_origem", "Falta registrar de onde veio o número deste contato.");
  if (!c.numero) definitivo("numero_invalido", "O número deste contato não é um telefone válido.");

  const { horarioInicio: inicio, horarioFim: fim } = c.limites;
  if (!dentroDoHorarioComercial(c.agora, { inicio, fim })) {
    espera("fora_do_horario", `Fora do horário comercial (segunda a sexta, das ${inicio}h às ${fim}h).`);
  }
  if (c.linha === "desconectada") espera("linha_desconectada", "O WhatsApp de prospecção não está conectado.");
  if (c.linha === "desconhecida") espera("linha_desconhecida", "Não consegui confirmar que o WhatsApp de prospecção está conectado.");

  const enviadas = c.historico.filter((m) => m.direcao === "SAIDA" && SAIU.has(m.status)).sort((a, b) => a.ocorridoEm.getTime() - b.ocorridoEm.getTime());
  const recebidas = c.historico.filter((m) => m.direcao === "ENTRADA").sort((a, b) => a.ocorridoEm.getTime() - b.ocorridoEm.getTime());
  const ultimaEnviada = enviadas[enviadas.length - 1];
  const ultimaRecebida = recebidas[recebidas.length - 1];

  if (c.tipo === "PRIMEIRO_CONTATO") {
    if (enviadas.length > 0 || recebidas.length > 0) definitivo("ja_ha_conversa", "Já existe conversa com este contato: escolha follow-up ou resposta.");
    if (c.primeirosContatosHoje >= c.limites.maxPrimeirosPorDia) {
      espera("limite_diario", `Limite de ${c.limites.maxPrimeirosPorDia} primeiros contatos por dia atingido.`);
    }
  }

  if (c.tipo === "FOLLOW_UP") {
    if (!ultimaEnviada) {
      definitivo("nada_para_acompanhar", "Ainda não há mensagem enviada para acompanhar.");
    } else {
      if (ultimaRecebida && ultimaRecebida.ocorridoEm > ultimaEnviada.ocorridoEm) {
        definitivo("contato_respondeu", "O contato respondeu: responda a ele em vez de fazer follow-up.");
      }
      if (c.agora.getTime() - ultimaEnviada.ocorridoEm.getTime() < c.limites.diasEntreMensagens * DIA_MS) {
        espera("intervalo", `A última mensagem foi há menos de ${c.limites.diasEntreMensagens} dias.`);
      }
      const desdeAResposta = ultimaRecebida ? enviadas.filter((m) => m.ocorridoEm > ultimaRecebida.ocorridoEm) : enviadas;
      if (desdeAResposta.length >= c.limites.maxTentativas) {
        definitivo("max_tentativas", `Já foram ${c.limites.maxTentativas} tentativas sem resposta.`);
      }
    }
  }

  if (c.tipo === "RESPOSTA" && recebidas.length === 0) {
    definitivo("sem_mensagem_para_responder", "Não há mensagem do contato para responder.");
  }

  if (enviadas.some((m) => igual(m.texto, c.texto))) definitivo("duplicada", "Uma mensagem idêntica já foi enviada para este contato.");

  return bloqueios.length === 0 ? { ok: true } : { ok: false, bloqueios };
}
