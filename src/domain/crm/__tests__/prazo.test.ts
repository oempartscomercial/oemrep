import { describe, it, expect } from "vitest";
import { descreverPrazo, diaDaSemana, formatarDia, formatarDiaComSemana, interpretarDia, proximoDiaUtil, situacaoDoPrazo, somarDias } from "../prazo";

describe("prazo do próximo passo", () => {
  it("classifica atrasado, hoje e futuro", () => {
    expect(situacaoDoPrazo("2026-10-05", "2026-10-06")).toBe("atrasado");
    expect(situacaoDoPrazo("2026-10-06", "2026-10-06")).toBe("hoje");
    expect(situacaoDoPrazo("2026-10-07", "2026-10-06")).toBe("futuro");
  });

  it("descreve em português", () => {
    expect(descreverPrazo("2026-10-06", "2026-10-06")).toBe("hoje");
    expect(descreverPrazo("2026-10-07", "2026-10-06")).toBe("amanhã");
    expect(descreverPrazo("2026-10-05", "2026-10-06")).toBe("ontem");
    expect(descreverPrazo("2026-10-09", "2026-10-06")).toBe("em 3 dias");
    expect(descreverPrazo("2026-10-01", "2026-10-06")).toBe("há 5 dias");
  });

  it("soma dias atravessando o mês e formata no padrão brasileiro", () => {
    expect(somarDias("2026-10-30", 3)).toBe("2026-11-02");
    expect(formatarDia("2026-10-09")).toBe("09/10/2026");
  });
});

describe("proximoDiaUtil", () => {
  it("dia útil fica como está; sábado e domingo passam para segunda", () => {
    expect(proximoDiaUtil("2026-10-09")).toBe("2026-10-09"); // sexta
    expect(proximoDiaUtil("2026-10-10")).toBe("2026-10-12"); // sábado
    expect(proximoDiaUtil("2026-10-11")).toBe("2026-10-12"); // domingo
  });
});

describe("dia da semana e leitura de datas ditas em conversa", () => {
  it("diz o dia da semana em português", () => {
    expect(diaDaSemana("2026-10-12")).toBe("segunda");
    expect(diaDaSemana("2026-10-18")).toBe("domingo");
    expect(formatarDiaComSemana("2026-10-16")).toBe("sexta, 16/10/2026");
  });

  it("aceita AAAA-MM-DD, DD/MM/AAAA, DD/MM (ano corrente), hoje e amanhã", () => {
    const hoje = "2026-10-14";
    expect(interpretarDia("2026-10-20", hoje)).toBe("2026-10-20");
    expect(interpretarDia("20/10/2026", hoje)).toBe("2026-10-20");
    expect(interpretarDia("5/1/2027", hoje)).toBe("2027-01-05");
    expect(interpretarDia("20/10", hoje)).toBe("2026-10-20");
    expect(interpretarDia(" hoje ", hoje)).toBe("2026-10-14");
    expect(interpretarDia("amanhã", hoje)).toBe("2026-10-15");
    expect(interpretarDia("Amanha", hoje)).toBe("2026-10-15");
  });

  it("recusa o que não é data (devolve null) em vez de adivinhar", () => {
    const hoje = "2026-10-14";
    expect(interpretarDia("sexta que vem", hoje)).toBeNull();
    expect(interpretarDia("31/02/2026", hoje)).toBeNull();
    expect(interpretarDia("2026-13-01", hoje)).toBeNull();
    expect(interpretarDia("", hoje)).toBeNull();
  });
});
