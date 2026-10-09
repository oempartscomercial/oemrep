import { describe, it, expect } from "vitest";
import { lerSlaDiasSemNota, validarDadosFabrica } from "../fabrica";

describe("validarDadosFabrica", () => {
  it("aceita dados válidos", () => {
    expect(validarDadosFabrica({ nome: "Bowden", cnpj: "11444777000161" })).toEqual([]);
  });

  it("rejeita nome vazio", () => {
    expect(validarDadosFabrica({ nome: "  ", cnpj: "11444777000161" })).toContain(
      "Nome é obrigatório.",
    );
  });

  it("rejeita CNPJ inválido", () => {
    expect(validarDadosFabrica({ nome: "Bowden", cnpj: "123" })).toContain(
      "CNPJ inválido.",
    );
  });
});

describe("lerSlaDiasSemNota", () => {
  it("vazio usa o padrão do sistema", () => {
    expect(lerSlaDiasSemNota("  ")).toEqual({ valor: null });
  });
  it("aceita dias inteiros de 1 a 365", () => {
    expect(lerSlaDiasSemNota("15")).toEqual({ valor: 15 });
  });
  it("recusa zero, fração e texto", () => {
    for (const bruto of ["0", "2.5", "abc", "400"]) expect(lerSlaDiasSemNota(bruto)).toHaveProperty("erro");
  });
});
