import { describe, it, expect } from "vitest";
import { decidirEfeitosDaEntrada } from "../efeitos";

const nada = { marcarNaoContatar: false, cancelar: null, moverParaConversando: false, passo: null } as const;

describe("decidirEfeitosDaEntrada — o que muda quando o contato escreve (ADR-015 §6)", () => {
  it("número sem empresa não muda nada", () => {
    expect(decidirEfeitosDaEntrada({ classificacao: null, situacaoEmpresa: null })).toEqual(nada);
    expect(decidirEfeitosDaEntrada({ classificacao: "NAO_CONTATAR", situacaoEmpresa: null })).toEqual(nada);
  });

  it("resposta de quem estava 'em contato' vira 'conversando' com o passo de responder", () => {
    expect(decidirEfeitosDaEntrada({ classificacao: null, situacaoEmpresa: "EM_CONTATO" })).toEqual({
      marcarNaoContatar: false, cancelar: "cadencia", moverParaConversando: true, passo: "responder",
    });
  });

  it("quem já conversa continua onde está; a mensagem só para a cadência", () => {
    expect(decidirEfeitosDaEntrada({ classificacao: null, situacaoEmpresa: "CONVERSANDO" })).toEqual({ ...nada, cancelar: "cadencia" });
    expect(decidirEfeitosDaEntrada({ classificacao: "INTERESSE", situacaoEmpresa: "AVANCO" })).toEqual({ ...nada, cancelar: "cadencia" });
  });

  it("pedido de parar marca o contato e a empresa, cancela tudo e não cria tarefa de responder", () => {
    for (const situacaoEmpresa of ["EM_CONTATO", "CONVERSANDO", "CLIENTE"]) {
      expect(decidirEfeitosDaEntrada({ classificacao: "NAO_CONTATAR", situacaoEmpresa })).toEqual({
        marcarNaoContatar: true, cancelar: "tudo", moverParaConversando: false, passo: null,
      });
    }
  });

  it("'sem interesse' não move nem suprime: pede para o Rômulo olhar a resposta", () => {
    for (const situacaoEmpresa of ["EM_CONTATO", "CONVERSANDO"]) {
      expect(decidirEfeitosDaEntrada({ classificacao: "NAO_INTERESSADO", situacaoEmpresa })).toEqual({
        ...nada, cancelar: "cadencia", passo: "avaliar_desinteresse",
      });
    }
  });

  it("empresa fora do funil ativo só tem a cadência cancelada", () => {
    for (const situacaoEmpresa of ["CANDIDATA", "APROVADA", "PAUSADA", "DESCARTADA", "CLIENTE"]) {
      expect(decidirEfeitosDaEntrada({ classificacao: null, situacaoEmpresa })).toEqual({ ...nada, cancelar: "cadencia" });
    }
  });
});
