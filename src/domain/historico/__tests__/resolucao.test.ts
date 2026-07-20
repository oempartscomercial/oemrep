import { describe, it, expect } from "vitest";
import { resolverFabricas, type FabricaCadastrada } from "../resolucao";
import type { TotalMensal } from "../tipos";

const cadastradas: FabricaCadastrada[] = [
  { id: "f-auto", nome: "AUTOFLEX" },
  { id: "f-bow", nome: "Bowden" },
];

const t = (fabricaNome: string, extra: Partial<TotalMensal> = {}): TotalMensal => ({
  ano: 2026,
  mes: 1,
  fabricaNome,
  valor: 100,
  ...extra,
});

describe("resolverFabricas", () => {
  it("resolve nome → id (case-insensitive) e marca o tipo de cada linha", () => {
    const r = resolverFabricas([t("AUTOFLEX")], [t("bowden")], cadastradas);
    expect(r.pendencias).toEqual([]);
    expect(r.linhas).toContainEqual({ ano: 2026, mes: 1, fabricaId: "f-auto", fabricaNome: "AUTOFLEX", tipo: "PEDIDO", valor: 100 });
    expect(r.linhas).toContainEqual({ ano: 2026, mes: 1, fabricaId: "f-bow", fabricaNome: "bowden", tipo: "NFE", valor: 100 });
  });

  it("coleta nome de fábrica não cadastrada como pendência (sem gerar linha)", () => {
    const r = resolverFabricas([t("SEINECA")], [], cadastradas);
    expect(r.linhas).toEqual([]);
    expect(r.pendencias).toEqual(["SEINECA"]);
  });

  it("não repete a mesma pendência", () => {
    const r = resolverFabricas([t("SEINECA"), t("SEINECA", { mes: 2 })], [t("SEINECA")], cadastradas);
    expect(r.pendencias).toEqual(["SEINECA"]);
  });
});
