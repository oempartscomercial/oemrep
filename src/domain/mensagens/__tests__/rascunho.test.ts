import { describe, it, expect } from "vitest";
import { rascunhoDeFollowUp, rascunhoDePrimeiroContato, tipoDeEnvioSugerido, validarRascunho } from "../rascunho";

describe("validarRascunho", () => {
  const bom = "Olá, tudo bem? Sou o Rômulo, da OEM Rep. Representamos a Rudolph, fábrica de peças de transmissão para tratores. Vi que vocês trabalham com eixos cardan. Quem cuida da compra dessa linha aí? Gostaria de apresentar nosso catálogo.";

  it("o modelo do CLAUDE.md, preenchido, passa como primeiro contato", () => {
    expect(validarRascunho(bom, "PRIMEIRO_CONTATO")).toEqual({ erros: [], avisos: [] });
  });

  it("texto vazio nunca passa", () => {
    expect(validarRascunho("   ", "RESPOSTA").erros).toEqual(["Escreva a mensagem."]);
  });

  it("primeiro contato: sem link, curto e com uma pergunta", () => {
    expect(validarRascunho(bom + " https://oemrep.com.br/catalogo", "PRIMEIRO_CONTATO").erros).toContain("A primeira mensagem não leva link: o objetivo é descobrir quem compra.");
    expect(validarRascunho(bom + " www.oemrep.com.br", "PRIMEIRO_CONTATO").erros).toContain("A primeira mensagem não leva link: o objetivo é descobrir quem compra.");
    expect(validarRascunho("Olá, tudo bem? ".padEnd(500, "x"), "PRIMEIRO_CONTATO").erros).toContain("A primeira mensagem deve ser curta (até 450 caracteres).");
    expect(validarRascunho("Olá! Sou o Rômulo, da OEM Rep. Representamos a Rudolph.", "PRIMEIRO_CONTATO").erros).toContain("A primeira mensagem precisa de uma pergunta: pergunte quem cuida da compra.");
  });

  it("não deixa sair com o espaço do modelo por preencher", () => {
    const erros = validarRascunho(bom.replace("eixos cardan", "[peça/marca vista no site]"), "PRIMEIRO_CONTATO").erros;
    expect(erros).toContain("Preencha o que está entre colchetes antes de aprovar.");
  });

  it("follow-up e resposta não têm as regras da primeira mensagem", () => {
    expect(validarRascunho("Segue o catálogo: https://oemrep.com.br/c", "RESPOSTA").erros).toEqual([]);
    expect(validarRascunho("Passando para saber se viu a mensagem anterior.", "FOLLOW_UP").erros).toEqual([]);
  });

  it("limite geral de tamanho", () => {
    expect(validarRascunho("a".repeat(1501), "RESPOSTA").erros).toContain("Mensagem longa demais (até 1500 caracteres).");
  });

  it("avisa, sem barrar, quando parece afirmar equivalência de peça", () => {
    const r = validarRascunho("A nossa peça substitui a original sem problema.", "RESPOSTA");
    expect(r.erros).toEqual([]);
    expect(r.avisos).toEqual(["Parece afirmar que uma peça substitui ou equivale a outra. Só diga isso com a equivalência confirmada pela fábrica."]);
  });

  it("pergunta sobre equivalência não dispara o aviso", () => {
    expect(validarRascunho("Vou confirmar com a fábrica se existe equivalente e te aviso.", "RESPOSTA").avisos).toEqual([]);
  });
});

describe("modelos", () => {
  it("o primeiro contato traz o espaço da peça para preencher", () => {
    const t = rascunhoDePrimeiroContato();
    expect(t).toContain("[peça/marca vista no site]");
    expect(t).toContain("Quem cuida da compra dessa linha aí?");
    expect(validarRascunho(t, "PRIMEIRO_CONTATO").erros).toEqual(["Preencha o que está entre colchetes antes de aprovar."]);
  });

  it("com a peça informada, já sai válido", () => {
    const t = rascunhoDePrimeiroContato("eixos cardan");
    expect(t).toContain("trabalham com eixos cardan");
    expect(validarRascunho(t, "PRIMEIRO_CONTATO")).toEqual({ erros: [], avisos: [] });
  });

  it("follow-up curto e sem pressão", () => {
    const t = rascunhoDeFollowUp();
    expect(t).toMatch(/Rudolph/);
    expect(validarRascunho(t, "FOLLOW_UP")).toEqual({ erros: [], avisos: [] });
  });
});

describe("tipoDeEnvioSugerido", () => {
  const h = (direcao: "ENTRADA" | "SAIDA", horas: number, status = direcao === "SAIDA" ? "ENVIADA" : "RECEBIDA") => ({ direcao, status, ocorridoEm: new Date(Date.UTC(2026, 9, 7, 0, 0) - horas * 3_600_000) });

  it("conversa vazia: primeiro contato", () => expect(tipoDeEnvioSugerido([])).toBe("PRIMEIRO_CONTATO"));
  it("a última mensagem é do contato: resposta", () => expect(tipoDeEnvioSugerido([h("SAIDA", 50), h("ENTRADA", 2)])).toBe("RESPOSTA"));
  it("a última é nossa: follow-up", () => expect(tipoDeEnvioSugerido([h("ENTRADA", 50), h("SAIDA", 2)])).toBe("FOLLOW_UP"));
  it("rascunho, falha e cancelada não contam como conversa", () => {
    expect(tipoDeEnvioSugerido([h("SAIDA", 5, "RASCUNHO"), h("SAIDA", 4, "FALHOU"), h("SAIDA", 3, "CANCELADA")])).toBe("PRIMEIRO_CONTATO");
  });
});
