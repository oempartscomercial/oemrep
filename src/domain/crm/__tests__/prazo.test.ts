import { describe, it, expect } from "vitest";
import { descreverPrazo, formatarDia, proximoDiaUtil, situacaoDoPrazo, somarDias } from "../prazo";

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
