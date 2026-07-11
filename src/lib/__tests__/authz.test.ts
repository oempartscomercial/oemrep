import { describe, it, expect } from "vitest";
import { podeAcessarFabrica, filtroFabricasPermitidas } from "../authz";

describe("podeAcessarFabrica", () => {
  it("ADMIN acessa qualquer fábrica mesmo sem vínculo", () => {
    expect(podeAcessarFabrica({ perfil: "ADMIN", fabricasIds: [] }, "fab-1")).toBe(true);
  });

  it("OPERADOR acessa fábrica vinculada", () => {
    expect(
      podeAcessarFabrica({ perfil: "OPERADOR", fabricasIds: ["fab-1"] }, "fab-1"),
    ).toBe(true);
  });

  it("ANALISTA não acessa fábrica não vinculada", () => {
    expect(
      podeAcessarFabrica({ perfil: "ANALISTA", fabricasIds: ["fab-1"] }, "fab-2"),
    ).toBe(false);
  });
});

describe("filtroFabricasPermitidas", () => {
  it("ADMIN não tem filtro (retorna null, vê todas as fábricas)", () => {
    expect(filtroFabricasPermitidas({ perfil: "ADMIN", fabricasIds: [] })).toBeNull();
  });

  it("OPERADOR é restrito às fábricas vinculadas", () => {
    expect(
      filtroFabricasPermitidas({ perfil: "OPERADOR", fabricasIds: ["fab-1", "fab-2"] }),
    ).toEqual(["fab-1", "fab-2"]);
  });

  it("ANALISTA sem nenhuma fábrica vinculada não vê nada (array vazio)", () => {
    expect(filtroFabricasPermitidas({ perfil: "ANALISTA", fabricasIds: [] })).toEqual([]);
  });
});
