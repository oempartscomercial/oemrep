import { describe, it, expect } from "vitest";
import { validarVinculoPedidos } from "../vinculo";

describe("validarVinculoPedidos (RN10)", () => {
  it("rejeita lista vazia", () => {
    expect(validarVinculoPedidos([])).toHaveLength(1);
  });

  it("aceita um único pedido", () => {
    expect(validarVinculoPedidos([{ id: "p1", clienteId: "c1" }])).toEqual([]);
  });

  it("aceita vários pedidos do mesmo cliente", () => {
    const erros = validarVinculoPedidos([
      { id: "p1", clienteId: "c1" },
      { id: "p2", clienteId: "c1" },
    ]);
    expect(erros).toEqual([]);
  });

  it("rejeita pedidos de clientes diferentes", () => {
    const erros = validarVinculoPedidos([
      { id: "p1", clienteId: "c1" },
      { id: "p2", clienteId: "c2" },
    ]);
    expect(erros).toHaveLength(1);
  });
});
