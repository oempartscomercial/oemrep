import { describe, it, expect } from "vitest";
import { validarDadosCliente } from "../cliente";

describe("validarDadosCliente", () => {
  it("aceita dados válidos com ao menos uma fábrica", () => {
    expect(
      validarDadosCliente({
        nomeFantasia: "Distribuidora X",
        cnpj: "11222333000181",
        fabricasIds: ["fab-1"],
      }),
    ).toEqual([]);
  });

  it("rejeita cliente sem nenhuma fábrica vinculada", () => {
    expect(
      validarDadosCliente({ nomeFantasia: "Distribuidora X", cnpj: "11222333000181", fabricasIds: [] }),
    ).toContain("Selecione ao menos uma fábrica.");
  });

  it("aceita empresa sem CNPJ: ele é pedido na conferência da NFe (ADR-013)", () => {
    expect(validarDadosCliente({ nomeFantasia: "Distribuidora X", cnpj: "  ", fabricasIds: ["fab-1"] })).toEqual([]);
  });

  it("rejeita CNPJ inválido", () => {
    expect(
      validarDadosCliente({ nomeFantasia: "Distribuidora X", cnpj: "123", fabricasIds: ["fab-1"] }),
    ).toContain("CNPJ inválido.");
  });
});
