import { describe, it, expect } from "vitest";
import { resumoDoMovimentoOportunidade, sugerirExpansao, validarMovimentoOportunidade } from "../oportunidade";

const HOJE = "2026-10-06";
const passo = { acao: "Mandar a tabela da Bowden", prazo: "2026-10-09", responsavelId: "u1" };

describe("validarMovimentoOportunidade", () => {
  it("a abordar não exige nada; etapas em andamento exigem próximo passo", () => {
    expect(validarMovimentoOportunidade("ABORDADO", "A_ABORDAR", {}, HOJE)).toEqual([]);
    expect(validarMovimentoOportunidade("A_ABORDAR", "ABORDADO", { proximoPasso: passo }, HOJE)).toEqual([]);
    expect(validarMovimentoOportunidade("A_ABORDAR", "COTACAO", {}, HOJE)).toEqual([
      "Diga qual é o próximo passo.",
      "Próximo passo: informe a data.",
      "Escolha quem fica responsável.",
    ]);
    expect(validarMovimentoOportunidade("A_ABORDAR", "INTERESSE", { proximoPasso: { ...passo, prazo: "2026-10-01" } }, HOJE)).toEqual([
      "Próximo passo: a data não pode estar no passado.",
    ]);
  });

  it("adiada pede retomada; perdida pede motivo", () => {
    expect(validarMovimentoOportunidade("ABORDADO", "ADIADA", {}, HOJE)).toEqual(["Retomada: informe a data."]);
    expect(validarMovimentoOportunidade("ABORDADO", "ADIADA", { retomadaEm: "2026-12-01" }, HOJE)).toEqual([]);
    expect(validarMovimentoOportunidade("ABORDADO", "PERDIDA", { motivo: " " }, HOJE)).toEqual(["Diga o motivo da perda."]);
    expect(validarMovimentoOportunidade("ABORDADO", "PERDIDA", { motivo: "Já tem fornecedor" }, HOJE)).toEqual([]);
  });

  it("ganha é automática e definitiva; perdida e adiada podem reabrir", () => {
    expect(validarMovimentoOportunidade("COTACAO", "GANHA", {}, HOJE)).toEqual([
      "A oportunidade fica ganha sozinha, quando chega o pedido desse cliente nessa fábrica.",
    ]);
    expect(validarMovimentoOportunidade("GANHA", "A_ABORDAR", {}, HOJE)).toEqual([
      "Oportunidade ganha não volta para o funil. Crie outra, se for o caso.",
    ]);
    expect(validarMovimentoOportunidade("PERDIDA", "A_ABORDAR", {}, HOJE)).toEqual([]);
    expect(validarMovimentoOportunidade("ADIADA", "ADIADA", {}, HOJE)).toEqual(["A oportunidade já está nesta etapa."]);
    expect(validarMovimentoOportunidade("ABORDADO", "INVENTADA", {}, HOJE)).toEqual(["Etapa desconhecida."]);
  });

  it("descreve a mudança para a linha do tempo", () => {
    expect(resumoDoMovimentoOportunidade("Bowden", "A_ABORDAR", "ABORDADO", {})).toBe("Bowden: A abordar → Abordado.");
    expect(resumoDoMovimentoOportunidade("Bowden", "COTACAO", "PERDIDA", { motivo: "Preço" })).toBe("Bowden: Cotação → Perdida. Motivo: Preço.");
    expect(resumoDoMovimentoOportunidade("Bowden", "COTACAO", "GANHA", {}, true)).toContain("movido automaticamente");
  });
});

describe("sugerirExpansao", () => {
  const fabricas = [
    { id: "f1", nome: "Autoflex" },
    { id: "f2", nome: "Bowden" },
    { id: "f3", nome: "Corven" },
  ];

  it("sugere as fábricas que o cliente ainda não compra, do que mais comprou para o que menos", () => {
    const r = sugerirExpansao(
      [
        { id: "c1", nome: "CYRO", fabricaIds: ["f1", "f2"], valorHistorico: 1000 },
        { id: "c2", nome: "AUPARTS", fabricaIds: ["f2"], valorHistorico: 5000 },
      ],
      fabricas,
      new Set(),
    );
    expect(r.map((s) => `${s.cliente}→${s.fabrica}`)).toEqual(["AUPARTS→Autoflex", "AUPARTS→Corven", "CYRO→Corven"]);
    expect(r[0].compra).toEqual(["Bowden"]);
  });

  it("pula oportunidade já aberta, a rede FILIAL-xx e cliente sem nenhuma fábrica", () => {
    const r = sugerirExpansao(
      [
        { id: "c1", nome: "CYRO", fabricaIds: ["f1"], valorHistorico: 10 },
        { id: "c2", nome: "FILIAL-19", fabricaIds: ["f1"], valorHistorico: 99999 },
        { id: "c3", nome: "SEM FABRICA", fabricaIds: [], valorHistorico: 50 },
      ],
      fabricas,
      new Set(["c1|f2"]),
    );
    expect(r.map((s) => `${s.cliente}→${s.fabrica}`)).toEqual(["CYRO→Corven"]);
  });

  it("respeita o limite", () => {
    const clientes = Array.from({ length: 10 }, (_, i) => ({ id: `c${i}`, nome: `C${i}`, fabricaIds: ["f1"], valorHistorico: i }));
    expect(sugerirExpansao(clientes, fabricas, new Set(), 5)).toHaveLength(5);
  });
});
