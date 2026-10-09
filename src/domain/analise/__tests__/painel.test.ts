import { describe, it, expect } from "vitest";
import { mesEmSaoPaulo, resumirPorFabrica } from "../painel";

const agora = new Date("2026-10-09T12:00:00Z");
const fabricas = [
  { id: "a", nome: "Autoflex" },
  { id: "b", nome: "Bowden" },
];

describe("mesEmSaoPaulo", () => {
  it("usa o fuso de São Paulo na virada do mês", () => {
    // 1º/10 às 01h UTC ainda é 30/09 em São Paulo.
    expect(mesEmSaoPaulo(new Date("2026-10-01T01:00:00Z"))).toBe("2026-09");
    expect(mesEmSaoPaulo(new Date("2026-10-01T04:00:00Z"))).toBe("2026-10");
  });
});

describe("resumirPorFabrica", () => {
  it("soma a faturar, recebido e faturado no mês por fábrica", () => {
    const resumo = resumirPorFabrica(
      fabricas,
      [
        { fabricaId: "a", estado: "SEM_NFE", dataRef: new Date("2026-10-02T12:00:00Z"), valor: 1000, saldo: 1000 },
        { fabricaId: "a", estado: "PARCIAL", dataRef: new Date("2026-09-20T12:00:00Z"), valor: 3000, saldo: 500 },
        { fabricaId: "a", estado: "COMPLETO", dataRef: new Date("2026-10-05T12:00:00Z"), valor: 200, saldo: 0 },
        { fabricaId: "b", estado: "SEM_NFE", dataRef: new Date("2026-08-01T12:00:00Z"), valor: 4000, saldo: 4000 },
      ],
      [
        { fabricaId: "a", dataEmissao: new Date("2026-10-06T12:00:00Z"), totalNota: 2500 },
        { fabricaId: "a", dataEmissao: new Date("2026-09-29T12:00:00Z"), totalNota: 999 },
        { fabricaId: null, dataEmissao: new Date("2026-10-06T12:00:00Z"), totalNota: 50 },
      ],
      agora,
    );

    expect(resumo.map((r) => r.nome)).toEqual(["Bowden", "Autoflex"]);
    expect(resumo.find((r) => r.id === "a")).toMatchObject({
      aFaturar: 1500,
      pedidosAbertos: 2,
      recebidoMes: 1200,
      pedidosMes: 2,
      faturadoMes: 2500,
      notasMes: 1,
    });
    expect(resumo.find((r) => r.id === "b")).toMatchObject({ aFaturar: 4000, recebidoMes: 0, faturadoMes: 0 });
  });

  it("mostra a fábrica mesmo sem movimento", () => {
    expect(resumirPorFabrica(fabricas, [], [], agora).every((r) => r.aFaturar === 0 && r.notasMes === 0)).toBe(true);
  });
});
