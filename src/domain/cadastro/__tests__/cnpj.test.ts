import { describe, it, expect } from "vitest";
import { normalizarCnpj, cnpjValido } from "../cnpj";

describe("normalizarCnpj", () => {
  it("remove pontuação e mantém só os dígitos", () => {
    expect(normalizarCnpj("11.444.777/0001-61")).toBe("11444777000161");
  });
});

describe("cnpjValido", () => {
  it("aceita CNPJ válido sem máscara", () => {
    expect(cnpjValido("11444777000161")).toBe(true);
  });

  it("aceita CNPJ válido com máscara", () => {
    expect(cnpjValido("11.444.777/0001-61")).toBe(true);
  });

  it("aceita outro CNPJ válido conhecido", () => {
    expect(cnpjValido("11.222.333/0001-81")).toBe(true);
  });

  it("rejeita dígito verificador incorreto", () => {
    expect(cnpjValido("11444777000162")).toBe(false);
  });

  it("rejeita CNPJ com todos os dígitos iguais", () => {
    expect(cnpjValido("11111111111111")).toBe(false);
  });

  it("rejeita CNPJ com tamanho incorreto", () => {
    expect(cnpjValido("123")).toBe(false);
  });
});
