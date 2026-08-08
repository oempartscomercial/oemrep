import { describe, it, expect } from "vitest";
import { formatarReais, emCentavos } from "../moeda";

describe("formatarReais", () => {
  it("usa vírgula decimal e ponto de milhar", () => {
    expect(formatarReais(1250.5)).toBe("R$ 1.250,50");
  });

  it("sempre mostra duas casas decimais", () => {
    expect(formatarReais(1200)).toBe("R$ 1.200,00");
    expect(formatarReais(0.5)).toBe("R$ 0,50");
  });

  it("agrupa milhares em valores grandes", () => {
    expect(formatarReais(1234567.89)).toBe("R$ 1.234.567,89");
  });

  it("não agrupa valores abaixo de mil", () => {
    expect(formatarReais(999.99)).toBe("R$ 999,99");
  });

  it("arredonda para o centavo mais próximo", () => {
    expect(formatarReais(25.5031)).toBe("R$ 25,50");
    expect(formatarReais(25.506)).toBe("R$ 25,51");
  });

  it("põe o sinal antes do símbolo em valores negativos", () => {
    expect(formatarReais(-84.3)).toBe("-R$ 84,30");
  });

  it("trata zero sem sinal", () => {
    expect(formatarReais(0)).toBe("R$ 0,00");
  });
});

describe("emCentavos", () => {
  it("converte reais em centavos inteiros", () => {
    expect(emCentavos(25.5)).toBe(2550);
  });

  it("arredonda casas além do centavo", () => {
    expect(emCentavos(25.5031)).toBe(2550);
    expect(emCentavos(25.506)).toBe(2551);
  });

  it("absorve o erro de ponto flutuante da multiplicação", () => {
    expect(emCentavos(1.005)).toBe(101);
    expect(emCentavos(19.99)).toBe(1999);
    expect(emCentavos(0.1 + 0.2)).toBe(30);
  });
});
