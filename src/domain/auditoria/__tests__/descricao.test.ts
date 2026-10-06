import { describe, it, expect } from "vitest";
import { descreverEvento } from "../descricao";

const nomes = {
  registros: { p1: "PED-001 · Bowden · CYRO", c1: "CYRO" },
  valores: { f1: "Bowden", f2: "Autoflex", c1: "CYRO" },
};

const evento = (campo: string, valorAnterior: string | null, valorNovo: string | null, entidade = "Pedido", entidadeId = "p1") => ({
  entidade,
  entidadeId,
  campo,
  valorAnterior,
  valorNovo,
});

describe("descreverEvento", () => {
  it("troca códigos internos por nomes e campos por rótulos", () => {
    expect(descreverEvento(evento("fabricaId", null, "f1"), nomes)).toEqual({
      registro: "Pedido PED-001 · Bowden · CYRO",
      campo: "Fábrica",
      de: "—",
      para: "Bowden",
    });
    expect(descreverEvento(evento("fabricasIds", "f1", "f1,f2", "Cliente", "c1"), nomes)).toEqual({
      registro: "Cliente CYRO",
      campo: "Fábricas",
      de: "Bowden",
      para: "Bowden, Autoflex",
    });
  });

  it("mostra estados, status e sim/não em português", () => {
    expect(descreverEvento(evento("estado", "SEM_NFE", "PARCIAL"), nomes)).toMatchObject({ campo: "Situação", de: "Sem NFe", para: "Parcial" });
    expect(descreverEvento(evento("status", "PENDENTE", "FORA_DE_FABRICACAO", "ItemPedido", "i1"), nomes)).toMatchObject({
      registro: "Item de pedido (removido)",
      de: "Pendente",
      para: "Fora de fabricação",
    });
    expect(descreverEvento(evento("semNumero", null, "false"), nomes)).toMatchObject({ campo: "Sem número", para: "Não" });
  });

  it("mantém o valor quando não há tradução", () => {
    expect(descreverEvento(evento("referencia", "A", "B", "Outra", "x"), nomes)).toEqual({
      registro: "Outra (removido)",
      campo: "referencia",
      de: "A",
      para: "B",
    });
  });
});
