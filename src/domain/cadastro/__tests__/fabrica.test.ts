import { describe, it, expect } from "vitest";
import { validarDadosFabrica } from "../fabrica";

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
