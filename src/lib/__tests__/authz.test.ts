import { describe, it, expect } from "vitest";
import { podeAcessarFabrica } from "../authz";

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
