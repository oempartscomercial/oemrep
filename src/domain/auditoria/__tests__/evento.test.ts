import { describe, it, expect } from "vitest";
import { compararCampos } from "../evento";

describe("compararCampos", () => {
  it("gera um evento por campo alterado", () => {
    const eventos = compararCampos(
      "Fabrica",
      "fab-1",
      "user-1",
      { nome: "Bowden", cnpj: "111" },
      { nome: "Bowden Ltda", cnpj: "111" },
    );

    expect(eventos).toEqual([
      {
        entidade: "Fabrica",
        entidadeId: "fab-1",
        campo: "nome",
        valorAnterior: "Bowden",
        valorNovo: "Bowden Ltda",
        usuarioId: "user-1",
      },
    ]);
  });

  it("não gera evento quando nada muda", () => {
    const eventos = compararCampos(
      "Fabrica",
      "fab-1",
      "user-1",
      { nome: "Bowden" },
      { nome: "Bowden" },
    );
    expect(eventos).toEqual([]);
  });

  it("trata criação (antes vazio) com valorAnterior nulo", () => {
    const eventos = compararCampos("Cliente", "cli-1", "user-1", {}, { nome: "Novo" });
    expect(eventos).toEqual([
      {
        entidade: "Cliente",
        entidadeId: "cli-1",
        campo: "nome",
        valorAnterior: null,
        valorNovo: "Novo",
        usuarioId: "user-1",
      },
    ]);
  });
});
