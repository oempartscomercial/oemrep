import { describe, it, expect } from "vitest";
import { filtrarPedidos } from "../filtro";

const PEDIDOS = [
  { id: "1", estado: "SEM_NFE" as const },
  { id: "2", estado: "PARCIAL" as const },
  { id: "3", estado: "COMPLETO" as const },
  { id: "4", estado: "ARQUIVADO" as const },
];

describe("filtrarPedidos", () => {
  it("EM_ANDAMENTO traz SEM_NFE e PARCIAL", () => {
    const resultado = filtrarPedidos(PEDIDOS, "EM_ANDAMENTO");
    expect(resultado.map((p) => p.id)).toEqual(["1", "2"]);
  });

  it("CONCLUIDOS traz apenas COMPLETO", () => {
    const resultado = filtrarPedidos(PEDIDOS, "CONCLUIDOS");
    expect(resultado.map((p) => p.id)).toEqual(["3"]);
  });

  it("ARQUIVADOS traz apenas ARQUIVADO", () => {
    const resultado = filtrarPedidos(PEDIDOS, "ARQUIVADOS");
    expect(resultado.map((p) => p.id)).toEqual(["4"]);
  });

  it("TODOS traz tudo sem filtrar", () => {
    expect(filtrarPedidos(PEDIDOS, "TODOS")).toHaveLength(4);
  });
});
