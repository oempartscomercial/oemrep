import { describe, it, expect } from "vitest";
import { resolverClienteDaNFe } from "../cliente";

const CNPJ_NOTA = "11222333000181";

describe("resolverClienteDaNFe", () => {
  it("usa o cliente cadastrado com o CNPJ da nota", () => {
    expect(resolverClienteDaNFe(CNPJ_NOTA, { id: "c1" }, null)).toEqual({ clienteId: "c1", gravarCnpj: false });
  });

  it("aceita o cliente escolhido quando ele é o mesmo do CNPJ", () => {
    expect(resolverClienteDaNFe(CNPJ_NOTA, { id: "c1" }, { id: "c1", cnpj: CNPJ_NOTA })).toEqual({
      clienteId: "c1",
      gravarCnpj: false,
    });
  });

  it("recusa escolher outra empresa quando o CNPJ da nota já é de alguém", () => {
    expect(resolverClienteDaNFe(CNPJ_NOTA, { id: "c1" }, { id: "c2", cnpj: null })).toEqual({
      erro: "O CNPJ desta nota já pertence a outra empresa cadastrada.",
    });
  });

  it("grava o CNPJ da nota no cliente escolhido que ainda não tem CNPJ (ADR-013)", () => {
    expect(resolverClienteDaNFe(CNPJ_NOTA, null, { id: "c2", cnpj: null })).toEqual({ clienteId: "c2", gravarCnpj: true });
  });

  it("recusa cliente escolhido que tem outro CNPJ", () => {
    expect(resolverClienteDaNFe(CNPJ_NOTA, null, { id: "c2", cnpj: "99888777000166" })).toEqual({
      erro: "A empresa escolhida tem outro CNPJ cadastrado.",
    });
  });

  it("sem cliente pelo CNPJ e sem escolha, fica pendente de escolha", () => {
    expect(resolverClienteDaNFe(CNPJ_NOTA, null, null)).toEqual({ clienteId: null, gravarCnpj: false });
  });
});
