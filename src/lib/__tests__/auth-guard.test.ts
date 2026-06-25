import { describe, it, expect } from "vitest";
import { rotaProtegida } from "../auth-guard";

describe("proteção de rotas", () => {
  it("não protege /login", () => {
    expect(rotaProtegida("/login")).toBe(false);
  });
  it("protege /pedidos", () => {
    expect(rotaProtegida("/pedidos")).toBe(true);
  });
});
