import type { ClassificacaoPorRegra } from "./supressao";

// O que muda no CRM quando um contato escreve na linha de prospecção (ADR-015 §5 e §6).
// Só decide; quem aplica é src/lib/whatsapp/efeitos.ts, dentro da mesma transação da mensagem.
export type EfeitosDaEntrada = {
  marcarNaoContatar: boolean;
  /** "cadencia" cancela primeiro contato e follow-up pendentes; "tudo" cancela também respostas. */
  cancelar: "cadencia" | "tudo" | null;
  moverParaConversando: boolean;
  passo: "responder" | "avaliar_desinteresse" | null;
};

const NADA: EfeitosDaEntrada = { marcarNaoContatar: false, cancelar: null, moverParaConversando: false, passo: null };

export function decidirEfeitosDaEntrada(entrada: {
  classificacao: ClassificacaoPorRegra | "INTERESSE" | "PERGUNTA_OBJECAO" | "AMBIGUA" | null;
  /** Situação da empresa ligada ao número; nulo = número sem empresa (nada muda). */
  situacaoEmpresa: string | null;
}): EfeitosDaEntrada {
  const { classificacao, situacaoEmpresa } = entrada;
  if (situacaoEmpresa === null) return NADA;

  if (classificacao === "NAO_CONTATAR") return { marcarNaoContatar: true, cancelar: "tudo", moverParaConversando: false, passo: null };

  const emAndamento = situacaoEmpresa === "EM_CONTATO" || situacaoEmpresa === "CONVERSANDO";
  if (classificacao === "NAO_INTERESSADO" && emAndamento) {
    return { ...NADA, cancelar: "cadencia", passo: "avaliar_desinteresse" };
  }
  if (situacaoEmpresa === "EM_CONTATO" && classificacao !== "NAO_INTERESSADO") {
    return { ...NADA, cancelar: "cadencia", moverParaConversando: true, passo: "responder" };
  }
  return { ...NADA, cancelar: "cadencia" };
}
