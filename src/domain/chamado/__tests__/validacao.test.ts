import { describe, it, expect } from "vitest";
import { validarAberturaChamado } from "../validacao";

describe("validarAberturaChamado (RF25/RF30)", () => {
  const dadosValidos = {
    notaFiscalId: "nfe-1",
    motivoId: "motivo-1",
    observacao: "Item chegou quebrado.",
    itensAfetadosIds: ["item-1"],
  };

  it("aceita dados completos", () => {
    expect(validarAberturaChamado(dadosValidos)).toEqual([]);
  });

  it("exige a NFe de origem", () => {
    expect(validarAberturaChamado({ ...dadosValidos, notaFiscalId: "" })).toContain(
      "NFe de origem não informada.",
    );
  });

  it("exige o motivo", () => {
    expect(validarAberturaChamado({ ...dadosValidos, motivoId: "" })).toContain(
      "Selecione o motivo da divergência.",
    );
  });

  it("exige a descrição da divergência", () => {
    expect(validarAberturaChamado({ ...dadosValidos, observacao: "   " })).toContain(
      "Descreva a divergência.",
    );
  });

  it("exige ao menos um item afetado (RF30)", () => {
    expect(validarAberturaChamado({ ...dadosValidos, itensAfetadosIds: [] })).toContain(
      "Selecione ao menos um item afetado.",
    );
  });
});
