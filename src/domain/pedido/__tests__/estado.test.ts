import { describe, it, expect } from "vitest";
import { transicaoValida } from "../estado";

describe("transição de estado do pedido", () => {
  it("permite SEM_NFE → PARCIAL", () => {
    expect(transicaoValida("SEM_NFE", "PARCIAL")).toBe(true);
  });
  it("permite PARCIAL → COMPLETO", () => {
    expect(transicaoValida("PARCIAL", "COMPLETO")).toBe(true);
  });
  it("permite COMPLETO → ARQUIVADO e ARQUIVADO → COMPLETO (reversível)", () => {
    expect(transicaoValida("COMPLETO", "ARQUIVADO")).toBe(true);
    expect(transicaoValida("ARQUIVADO", "COMPLETO")).toBe(true);
  });
  it("rejeita SEM_NFE → COMPLETO (pula PARCIAL)", () => {
    expect(transicaoValida("SEM_NFE", "COMPLETO")).toBe(false);
  });
  it("rejeita ARQUIVADO → SEM_NFE", () => {
    expect(transicaoValida("ARQUIVADO", "SEM_NFE")).toBe(false);
  });
});
