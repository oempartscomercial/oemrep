import { describe, it, expect } from "vitest";
import { calcularGap, type PedidoParaGap } from "../gap";

describe("calcularGap (RF31, ADR-007)", () => {
  it("gap = valor pedido de produtos − valor faturado de produtos, por pedido", () => {
    const pedidos: PedidoParaGap[] = [
      {
        fabrica: "Bowden",
        cliente: "Cliente A",
        criadoEm: new Date("2026-07-10T12:00:00Z"),
        itens: [{ quantidadePedida: 10, valorUnitario: 5 }], // pedido = 50
        itensFaturados: [{ quantidadeFaturada: 4, valorUnitario: 5 }], // faturado = 20
      },
    ];
    expect(calcularGap(pedidos)).toEqual([
      { mes: "2026-07", fabrica: "Bowden", cliente: "Cliente A", valorPedido: 50, valorFaturado: 20, gap: 30 },
    ]);
  });

  it("agrupa por mês + fábrica + cliente, somando os pedidos do grupo", () => {
    const pedidos: PedidoParaGap[] = [
      {
        fabrica: "Bowden",
        cliente: "Cliente A",
        criadoEm: new Date("2026-07-05T12:00:00Z"),
        itens: [{ quantidadePedida: 2, valorUnitario: 10 }], // 20
        itensFaturados: [],
      },
      {
        fabrica: "Bowden",
        cliente: "Cliente A",
        criadoEm: new Date("2026-07-28T12:00:00Z"),
        itens: [{ quantidadePedida: 3, valorUnitario: 10 }], // 30
        itensFaturados: [{ quantidadeFaturada: 1, valorUnitario: 10 }], // 10
      },
    ];
    expect(calcularGap(pedidos)).toEqual([
      { mes: "2026-07", fabrica: "Bowden", cliente: "Cliente A", valorPedido: 50, valorFaturado: 10, gap: 40 },
    ]);
  });

  it("separa grupos de meses/fábricas/clientes diferentes e ordena por mês desc", () => {
    const pedidos: PedidoParaGap[] = [
      {
        fabrica: "Bowden",
        cliente: "Cliente A",
        criadoEm: new Date("2026-06-15T12:00:00Z"),
        itens: [{ quantidadePedida: 1, valorUnitario: 100 }],
        itensFaturados: [],
      },
      {
        fabrica: "Autoflex",
        cliente: "Cliente B",
        criadoEm: new Date("2026-07-15T12:00:00Z"),
        itens: [{ quantidadePedida: 1, valorUnitario: 200 }],
        itensFaturados: [],
      },
    ];
    const linhas = calcularGap(pedidos);
    expect(linhas.map((l) => `${l.mes}|${l.fabrica}|${l.cliente}`)).toEqual([
      "2026-07|Autoflex|Cliente B",
      "2026-06|Bowden|Cliente A",
    ]);
  });

  it("retorna vazio para lista vazia", () => {
    expect(calcularGap([])).toEqual([]);
  });
});
