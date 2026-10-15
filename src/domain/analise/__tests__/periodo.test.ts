import { describe, it, expect } from "vitest";
import { inicioDoAcompanhamentoNfe, mesesDoPeriodo, recortarSerie } from "../periodo";
import type { PontoMensal } from "../totaisMensais";

const p = (mes: string, valorPedido: number, valorNfe = 0): PontoMensal => ({ mes, valorPedido, valorNfe });

describe("mesesDoPeriodo", () => {
  it("devolve os últimos N meses até o mês atual, em ordem", () => {
    expect(mesesDoPeriodo("6m", "2026-10", "2023-01")).toEqual(["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"]);
    expect(mesesDoPeriodo("12m", "2026-03", "2020-01")[0]).toBe("2025-04");
    expect(mesesDoPeriodo("24m", "2026-10", "2020-01")).toHaveLength(24);
  });

  it("'ano' começa em janeiro do ano atual", () => {
    expect(mesesDoPeriodo("ano", "2026-03", "2023-01")).toEqual(["2026-01", "2026-02", "2026-03"]);
  });

  it("'tudo' começa no primeiro mês com dado", () => {
    const meses = mesesDoPeriodo("tudo", "2026-10", "2023-01");
    expect(meses[0]).toBe("2023-01");
    expect(meses.at(-1)).toBe("2026-10");
    expect(meses).toHaveLength(46);
  });
});

describe("recortarSerie", () => {
  it("preenche com zero os meses sem dado e ignora os de fora do período", () => {
    const serie = [p("2026-01", 50, 0), p("2026-07", 100, 80), p("2026-09", 120, 90)];
    expect(recortarSerie(serie, "6m", "2026-10")).toEqual([
      p("2026-05", 0),
      p("2026-06", 0),
      p("2026-07", 100, 80),
      p("2026-08", 0),
      p("2026-09", 120, 90),
      p("2026-10", 0),
    ]);
  });

  it("sem dado nenhum, 'tudo' vira só o mês atual", () => {
    expect(recortarSerie([], "tudo", "2026-10")).toEqual([p("2026-10", 0)]);
  });
});

describe("inicioDoAcompanhamentoNfe", () => {
  it("é o primeiro mês com NFe registrada", () => {
    expect(inicioDoAcompanhamentoNfe([p("2025-01", 10), p("2026-06", 10, 5), p("2026-07", 10, 0)])).toBe("2026-06");
  });
  it("sem NFe nenhuma, null", () => {
    expect(inicioDoAcompanhamentoNfe([p("2025-01", 10)])).toBeNull();
  });
});
