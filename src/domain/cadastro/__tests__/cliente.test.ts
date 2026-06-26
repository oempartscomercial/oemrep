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

  it("rejeita CNPJ inválido", () => {
    expect(
      validarDadosCliente({ nomeFantasia: "Distribuidora X", cnpj: "123", fabricasIds: ["fab-1"] }),
    ).toContain("CNPJ inválido.");
  });
});
