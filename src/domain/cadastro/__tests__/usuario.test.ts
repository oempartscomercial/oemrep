import { describe, it, expect } from "vitest";
import { validarDadosUsuario } from "../usuario";

describe("validarDadosUsuario", () => {
  it("aceita ADMIN sem fábrica vinculada", () => {
    expect(
      validarDadosUsuario({ nome: "Ana", email: "ana@exemplo.com", perfil: "ADMIN", fabricasIds: [] }),
    ).toEqual([]);
  });

  it("exige ao menos uma fábrica para OPERADOR/ANALISTA", () => {
    expect(
      validarDadosUsuario({ nome: "Bia", email: "bia@exemplo.com", perfil: "OPERADOR", fabricasIds: [] }),
    ).toContain("Operador e Analista precisam de ao menos uma fábrica.");
  });

  it("rejeita e-mail mal formado", () => {
    expect(
      validarDadosUsuario({ nome: "Bia", email: "invalido", perfil: "ADMIN", fabricasIds: [] }),
    ).toContain("E-mail inválido.");
  });

  it("rejeita nome vazio", () => {
    expect(
      validarDadosUsuario({ nome: "  ", email: "ana@exemplo.com", perfil: "ADMIN", fabricasIds: [] }),
    ).toContain("Nome é obrigatório.");
  });
});
