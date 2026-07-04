import { describe, it, expect } from "vitest";
import { calcularQtdPendente, deveCongelarPendencia } from "../item";

describe("calcularQtdPendente", () => {
  it("calcula a diferença entre pedida e faturada", () => {
    expect(calcularQtdPendente({ quantidadePedida: 10, quantidadeFaturada: 4 })).toBe(6);
  });

  it("retorna 0 quando totalmente faturado", () => {
    expect(calcularQtdPendente({ quantidadePedida: 10, quantidadeFaturada: 10 })).toBe(0);
  });
});

describe("deveCongelarPendencia (ADR-008)", () => {
  it("congela ao passar de PENDENTE para FORA_DE_FABRICACAO", () => {
    expect(deveCongelarPendencia("PENDENTE", "FORA_DE_FABRICACAO")).toBe(true);
  });

  it("congela ao passar de PENDENTE para DESISTENCIA", () => {
    expect(deveCongelarPendencia("PENDENTE", "DESISTENCIA")).toBe(true);
  });

  it("não congela ao passar para OK", () => {
    expect(deveCongelarPendencia("PENDENTE", "OK")).toBe(false);
  });

  it("não re-congela se já estava resolvido por não-faturamento", () => {
    expect(deveCongelarPendencia("DESISTENCIA", "FORA_DE_FABRICACAO")).toBe(false);
  });
});
