import { describe, it, expect } from "vitest";
import { ITENS_MENU } from "../nav-itens";

describe("menu lateral", () => {
  it("tem os módulos do MVP em ordem", () => {
    expect(ITENS_MENU.map((i) => i.href)).toEqual([
      "/", "/pedidos", "/conferencia", "/rastreio",
      "/divergencias", "/pedidos-x-nfe", "/alertas", "/cadastros",
    ]);
  });
});
