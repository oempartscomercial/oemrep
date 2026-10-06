import { describe, it, expect } from "vitest";
import { menuDoPerfil } from "../nav-itens";

const rotas = (perfil: "OPERADOR" | "ANALISTA" | "ADMIN") => menuDoPerfil(perfil).map((i) => i.href);

describe("menuDoPerfil (PRD §4)", () => {
  it("só ADMIN vê Cadastros", () => {
    expect(rotas("ADMIN")).toContain("/cadastros");
    expect(rotas("ANALISTA")).not.toContain("/cadastros");
    expect(rotas("OPERADOR")).not.toContain("/cadastros");
  });

  it("Auditoria é de ADMIN e ANALISTA", () => {
    expect(rotas("ADMIN")).toContain("/auditoria");
    expect(rotas("ANALISTA")).toContain("/auditoria");
    expect(rotas("OPERADOR")).not.toContain("/auditoria");
  });

  it("todos veem a operação de pedidos", () => {
    for (const perfil of ["OPERADOR", "ANALISTA", "ADMIN"] as const) {
      expect(rotas(perfil)).toEqual(expect.arrayContaining(["/", "/pedidos", "/conferencia", "/rastreio", "/divergencias"]));
    }
  });
});
