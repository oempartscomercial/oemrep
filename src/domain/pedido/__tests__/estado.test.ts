import { describe, it, expect } from "vitest";
import { transicaoValida, recalcularEstado } from "../estado";

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

describe("recalcularEstado (ADR-005)", () => {
  it("mantém SEM_NFE mesmo com itens resolvidos (ainda não há NFe)", () => {
    expect(recalcularEstado("SEM_NFE", [{ status: "DESISTENCIA" }])).toBe("SEM_NFE");
  });

  it("mantém ARQUIVADO independente dos itens", () => {
    expect(recalcularEstado("ARQUIVADO", [{ status: "PENDENTE" }])).toBe("ARQUIVADO");
  });

  it("permanece PARCIAL quando ao menos um item está PENDENTE", () => {
    expect(
      recalcularEstado("PARCIAL", [{ status: "OK" }, { status: "PENDENTE" }]),
    ).toBe("PARCIAL");
  });

  it("vira COMPLETO quando todos os itens estão OK", () => {
    expect(
      recalcularEstado("PARCIAL", [{ status: "OK" }, { status: "OK" }]),
    ).toBe("COMPLETO");
  });

  it("vira COMPLETO quando os itens restantes são FORA_DE_FABRICACAO/DESISTENCIA", () => {
    expect(
      recalcularEstado("PARCIAL", [
        { status: "OK" },
        { status: "FORA_DE_FABRICACAO" },
        { status: "DESISTENCIA" },
      ]),
    ).toBe("COMPLETO");
  });
});
