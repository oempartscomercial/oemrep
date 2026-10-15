import { describe, it, expect } from "vitest";
import { abreviarReais, formatarReais, emCentavos } from "../moeda";

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

describe("abreviarReais", () => {
  it("abrevia milhões e milhares com uma casa, sem ',0'", () => {
    expect(abreviarReais(1_234_567)).toBe("R$ 1,2 mi");
    expect(abreviarReais(2_000_000)).toBe("R$ 2 mi");
    expect(abreviarReais(12_500)).toBe("R$ 12,5 mil");
    expect(abreviarReais(850_000)).toBe("R$ 850 mil");
    expect(abreviarReais(3_400_000_000)).toBe("R$ 3,4 bi");
  });

  it("valores abaixo de mil ficam inteiros; zero e negativos também", () => {
    expect(abreviarReais(0)).toBe("R$ 0");
    expect(abreviarReais(999.4)).toBe("R$ 999");
    expect(abreviarReais(-1_500_000)).toBe("-R$ 1,5 mi");
  });

  it("arredonda para cima de faixa sem escrever '1.000 mil'", () => {
    expect(abreviarReais(999_960)).toBe("R$ 1 mi");
  });
});
