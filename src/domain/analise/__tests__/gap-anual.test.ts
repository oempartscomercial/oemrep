import { describe, it, expect } from "vitest";
import { filtrarGap, totaisPorAno, type LinhaGap } from "../gap";

const linha = (mes: string, fabrica: string, valorPedido: number, valorFaturado: number): LinhaGap => ({
  mes, fabrica, cliente: "Cyro", valorPedido, valorFaturado, gap: valorPedido - valorFaturado,
});

const linhas = [linha("2026-10", "Bowden", 100, 40), linha("2026-03", "Autoflex", 50, 50), linha("2025-12", "Bowden", 80, 0)];

describe("Pedidos × NFe por ano (RN21)", () => {
  it("filtra por ano e mês", () => {
    expect(filtrarGap(linhas, { ano: "2026" }).map((l) => l.mes)).toEqual(["2026-10", "2026-03"]);
    expect(filtrarGap(linhas, { ano: "2026", fabrica: "Bowden" })).toHaveLength(1);
    expect(filtrarGap(linhas, {})).toHaveLength(3);
  });

  it("soma o total de cada ano, mais recente primeiro", () => {
    expect(totaisPorAno(linhas)).toEqual([
      { ano: "2026", valorPedido: 150, valorFaturado: 90, gap: 60 },
      { ano: "2025", valorPedido: 80, valorFaturado: 0, gap: 80 },
    ]);
  });
});
