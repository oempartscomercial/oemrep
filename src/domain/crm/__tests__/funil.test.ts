import { describe, it, expect } from "vitest";
import { agruparPorEtapa, resumoDoMovimento, validarMovimento } from "../funil";

const HOJE = "2026-10-06";
const passo = { acao: "Ligar para o comprador", prazo: "2026-10-09", responsavelId: "u1" };
const mov = (de: string, para: string, naoContatar = false) => ({ de, para, naoContatar });

describe("validarMovimento", () => {
  it("etapa ativa exige próximo passo com ação, data e responsável", () => {
    expect(validarMovimento(mov("CANDIDATA", "APROVADA"), { proximoPasso: passo }, HOJE)).toEqual([]);
    expect(validarMovimento(mov("CANDIDATA", "APROVADA"), {}, HOJE)).toEqual([
      "Diga qual é o próximo passo.",
      "Próximo passo: informe a data.",
      "Escolha quem fica responsável.",
    ]);
  });

  it("recusa data no passado e data malformada", () => {
    const antigo = { ...passo, prazo: "2026-10-05" };
    expect(validarMovimento(mov("CANDIDATA", "EM_CONTATO"), { proximoPasso: antigo }, HOJE)).toEqual([
      "Próximo passo: a data não pode estar no passado.",
    ]);
    expect(validarMovimento(mov("CANDIDATA", "EM_CONTATO"), { proximoPasso: { ...passo, prazo: "amanhã" } }, HOJE)).toHaveLength(1);
    expect(validarMovimento(mov("CANDIDATA", "EM_CONTATO"), { proximoPasso: { ...passo, prazo: HOJE } }, HOJE)).toEqual([]);
  });

  it("voltar para candidata não exige nada; pausada pede retomada; descartada pede motivo", () => {
    expect(validarMovimento(mov("EM_CONTATO", "CANDIDATA"), {}, HOJE)).toEqual([]);
    expect(validarMovimento(mov("EM_CONTATO", "PAUSADA"), {}, HOJE)).toEqual(["Retomada: informe a data."]);
    expect(validarMovimento(mov("EM_CONTATO", "PAUSADA"), { retomadaEm: "2026-11-10" }, HOJE)).toEqual([]);
    expect(validarMovimento(mov("EM_CONTATO", "DESCARTADA"), { motivo: "  " }, HOJE)).toEqual(["Diga o motivo do descarte."]);
    expect(validarMovimento(mov("EM_CONTATO", "DESCARTADA"), { motivo: "Só vende marca própria" }, HOJE)).toEqual([]);
  });

  it("cliente não entra nem sai do funil à mão", () => {
    expect(validarMovimento(mov("CLIENTE", "CANDIDATA"), {}, HOJE)).toEqual(["Cliente não volta para o funil de prospecção."]);
    expect(validarMovimento(mov("AVANCO", "CLIENTE"), {}, HOJE)).toEqual([
      "A empresa vira cliente sozinha, quando o primeiro pedido é lançado.",
    ]);
  });

  it("empresa marcada como não contatar não vai para contato", () => {
    expect(validarMovimento(mov("APROVADA", "EM_CONTATO", true), { proximoPasso: passo }, HOJE)).toEqual([
      'Esta empresa está marcada como "não contatar".',
    ]);
    expect(validarMovimento(mov("APROVADA", "DESCARTADA", true), { motivo: "Pediu para sair" }, HOJE)).toEqual([]);
  });

  it("recusa mover para a mesma etapa ou etapa desconhecida", () => {
    expect(validarMovimento(mov("APROVADA", "APROVADA"), {}, HOJE)).toEqual(["A empresa já está nesta etapa."]);
    expect(validarMovimento(mov("APROVADA", "INVENTADA"), {}, HOJE)).toEqual(["Etapa desconhecida."]);
  });
});

describe("resumoDoMovimento / agruparPorEtapa", () => {
  it("descreve a mudança para a linha do tempo", () => {
    expect(resumoDoMovimento("CANDIDATA", "APROVADA", {})).toBe("Etapa: A avaliar → Aprovada.");
    expect(resumoDoMovimento("APROVADA", "DESCARTADA", { motivo: "Sem interesse" })).toBe("Etapa: Aprovada → Descartada. Motivo: Sem interesse.");
    expect(resumoDoMovimento("EM_CONTATO", "CONVERSANDO", {}, true)).toContain("movido automaticamente");
  });

  it("agrupa por etapa do quadro e deixa pausadas/descartadas de fora", () => {
    const g = agruparPorEtapa([{ situacao: "CANDIDATA" }, { situacao: "AVANCO" }, { situacao: "PAUSADA" }, { situacao: "CLIENTE" }]);
    expect(g.CANDIDATA).toHaveLength(1);
    expect(g.AVANCO).toHaveLength(1);
    expect(Object.values(g).flat()).toHaveLength(2);
  });
});
