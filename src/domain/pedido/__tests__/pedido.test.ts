import { describe, it, expect } from "vitest";
import { validarDadosPedido } from "../pedido";

const ITEM_VALIDO = { referencia: "REF-1", descricao: "Peça", quantidade: 5, valorUnitario: 10 };

describe("validarDadosPedido", () => {
  it("aceita pedido com número", () => {
    expect(
      validarDadosPedido({
        numero: "PED-001",
        semNumero: false,
        fabricaId: "fab-1",
        clienteId: "cli-1",
        itens: [ITEM_VALIDO],
      }),
    ).toEqual([]);
  });

  it("aceita pedido S/N sem número", () => {
    expect(
      validarDadosPedido({
        numero: "",
        semNumero: true,
        fabricaId: "fab-1",
        clienteId: "cli-1",
        itens: [ITEM_VALIDO],
      }),
    ).toEqual([]);
  });

  it("rejeita pedido sem número e sem marcar S/N", () => {
    expect(
      validarDadosPedido({
        numero: "",
        semNumero: false,
        fabricaId: "fab-1",
        clienteId: "cli-1",
        itens: [ITEM_VALIDO],
      }),
    ).toContain("Informe o número do pedido ou marque S/N.");
  });

  it("rejeita pedido sem fábrica", () => {
    expect(
      validarDadosPedido({
        numero: "PED-001",
        semNumero: false,
        fabricaId: "",
        clienteId: "cli-1",
        itens: [ITEM_VALIDO],
      }),
    ).toContain("Selecione a fábrica.");
  });

  it("rejeita pedido sem itens", () => {
    expect(
      validarDadosPedido({
        numero: "PED-001",
        semNumero: false,
        fabricaId: "fab-1",
        clienteId: "cli-1",
        itens: [],
      }),
    ).toContain("Adicione ao menos um item.");
  });

  it("rejeita item com quantidade zero ou negativa", () => {
    const erros = validarDadosPedido({
      numero: "PED-001",
      semNumero: false,
      fabricaId: "fab-1",
      clienteId: "cli-1",
      itens: [{ ...ITEM_VALIDO, quantidade: 0 }],
    });
    expect(erros).toContain("Item 1: quantidade deve ser maior que zero.");
  });

  it("rejeita item sem referência", () => {
    const erros = validarDadosPedido({
      numero: "PED-001",
      semNumero: false,
      fabricaId: "fab-1",
      clienteId: "cli-1",
      itens: [{ ...ITEM_VALIDO, referencia: "  " }],
    });
    expect(erros).toContain("Item 1: referência é obrigatória.");
  });
});
