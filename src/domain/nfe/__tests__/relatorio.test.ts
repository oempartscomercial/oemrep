import { describe, it, expect } from "vitest";
import { agruparCruzamentoPorPedido, type LinhaFaturamento } from "../relatorio";

const linha = (sobrescreve: Partial<LinhaFaturamento> = {}): LinhaFaturamento => ({
  pedidoId: "p1",
  pedidoNumero: "PED-1",
  referencia: "REF-1",
  descricao: "Peça 1",
  quantidadeFaturada: 2,
  valorUnitario: 10,
  ...sobrescreve,
});

describe("agruparCruzamentoPorPedido (RF17)", () => {
  it("agrupa linhas de um único pedido e soma o total faturado", () => {
    const grupos = agruparCruzamentoPorPedido([
      linha({ quantidadeFaturada: 2, valorUnitario: 10 }),
      linha({ referencia: "REF-2", quantidadeFaturada: 3, valorUnitario: 5 }),
    ]);

    expect(grupos).toHaveLength(1);
    expect(grupos[0].linhas).toHaveLength(2);
    expect(grupos[0].totalFaturado).toBe(2 * 10 + 3 * 5);
  });

  it("separa por pedido quando a NFe cobre vários pedidos (RN10)", () => {
    const grupos = agruparCruzamentoPorPedido([
      linha({ pedidoId: "p1", pedidoNumero: "PED-1" }),
      linha({ pedidoId: "p2", pedidoNumero: "PED-2" }),
    ]);

    expect(grupos.map((g) => g.pedidoId).sort()).toEqual(["p1", "p2"]);
  });

  it("retorna lista vazia para nenhuma linha", () => {
    expect(agruparCruzamentoPorPedido([])).toEqual([]);
  });
});
