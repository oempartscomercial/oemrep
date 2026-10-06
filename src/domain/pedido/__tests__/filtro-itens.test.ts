import { describe, it, expect } from "vitest";
import { lerFiltroItens, intervaloDoMes } from "../filtro-itens";

describe("lerFiltroItens (RF06)", () => {
  it("por padrão mostra só os pendentes, sem outros filtros, na página 1", () => {
    expect(lerFiltroItens({})).toEqual({ status: "PENDENTE", pagina: 1 });
  });

  it("aceita os filtros válidos e ignora os inválidos", () => {
    expect(
      lerFiltroItens({ fabricaId: "f1", clienteId: "c1", mes: "2026-07", referencia: "  bw-12 ", status: "TODOS", pagina: "3" }),
    ).toEqual({ fabricaId: "f1", clienteId: "c1", mes: "2026-07", referencia: "bw-12", status: "TODOS", pagina: 3 });
    expect(lerFiltroItens({ mes: "julho", status: "QUALQUER", pagina: "-2" })).toEqual({ status: "PENDENTE", pagina: 1 });
  });
});

describe("intervaloDoMes", () => {
  it("vai do primeiro dia do mês ao primeiro do mês seguinte", () => {
    expect(intervaloDoMes("2026-12")).toEqual({
      gte: new Date("2026-12-01T00:00:00.000Z"),
      lt: new Date("2027-01-01T00:00:00.000Z"),
    });
  });
});
