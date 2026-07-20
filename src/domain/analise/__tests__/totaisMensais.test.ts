import { describe, it, expect } from "vitest";
import {
  calcularTotaisMensaisAoVivo,
  combinarSeries,
  type HistoricoMensalRow,
} from "../totaisMensais";

describe("calcularTotaisMensaisAoVivo", () => {
  it("soma pedidos (qtd × valor unit.) e NFes (total) por mês UTC", () => {
    const pontos = calcularTotaisMensaisAoVivo(
      [
        { criadoEm: new Date(Date.UTC(2026, 6, 5)), itens: [{ quantidadePedida: 2, valorUnitario: 10 }, { quantidadePedida: 1, valorUnitario: 5 }] },
        { criadoEm: new Date(Date.UTC(2026, 6, 20)), itens: [{ quantidadePedida: 3, valorUnitario: 10 }] },
      ],
      [{ dataEmissao: new Date(Date.UTC(2026, 6, 10)), totalNota: 100 }],
    );
    expect(pontos).toEqual([{ mes: "2026-07", valorPedido: 55, valorNfe: 100 }]);
  });
});

describe("combinarSeries", () => {
  it("mescla histórico e ao vivo por mês e ordena crescente mesmo com entrada fora de ordem", () => {
    const historico: HistoricoMensalRow[] = [
      { ano: 2026, mes: 2, tipo: "PEDIDO", valor: 500 },
      { ano: 2026, mes: 1, tipo: "PEDIDO", valor: 1000 },
      { ano: 2026, mes: 1, tipo: "NFE", valor: 800 },
    ];
    const aoVivo = [{ mes: "2026-07", valorPedido: 55, valorNfe: 100 }];

    const serie = combinarSeries(historico, aoVivo);

    expect(serie).toEqual([
      { mes: "2026-01", valorPedido: 1000, valorNfe: 800 },
      { mes: "2026-02", valorPedido: 500, valorNfe: 0 },
      { mes: "2026-07", valorPedido: 55, valorNfe: 100 },
    ]);
  });

  it("soma os dois lados quando o mesmo mês existe no histórico e ao vivo", () => {
    const serie = combinarSeries(
      [{ ano: 2026, mes: 7, tipo: "PEDIDO", valor: 10 }],
      [{ mes: "2026-07", valorPedido: 5, valorNfe: 3 }],
    );
    expect(serie).toEqual([{ mes: "2026-07", valorPedido: 15, valorNfe: 3 }]);
  });
});
