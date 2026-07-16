import { describe, it, expect } from "vitest";
import {
  transicaoChamadoValida,
  proximosEstadosChamado,
  ESTADOS_CHAMADO,
} from "../estado";

describe("transição de estado do chamado (ADR-004)", () => {
  it("permite ABERTO → EM_TRATATIVA", () => {
    expect(transicaoChamadoValida("ABERTO", "EM_TRATATIVA")).toBe(true);
  });
  it("permite EM_TRATATIVA → AGUARDANDO", () => {
    expect(transicaoChamadoValida("EM_TRATATIVA", "AGUARDANDO")).toBe(true);
  });
  it("permite EM_TRATATIVA → RESOLVIDO", () => {
    expect(transicaoChamadoValida("EM_TRATATIVA", "RESOLVIDO")).toBe(true);
  });
  it("permite voltar de AGUARDANDO → EM_TRATATIVA", () => {
    expect(transicaoChamadoValida("AGUARDANDO", "EM_TRATATIVA")).toBe(true);
  });
  it("permite AGUARDANDO → RESOLVIDO", () => {
    expect(transicaoChamadoValida("AGUARDANDO", "RESOLVIDO")).toBe(true);
  });
  it("rejeita pular etapas: ABERTO → RESOLVIDO", () => {
    expect(transicaoChamadoValida("ABERTO", "RESOLVIDO")).toBe(false);
  });
  it("rejeita pular etapas: ABERTO → AGUARDANDO", () => {
    expect(transicaoChamadoValida("ABERTO", "AGUARDANDO")).toBe(false);
  });
  it("trata RESOLVIDO como estado final", () => {
    expect(transicaoChamadoValida("RESOLVIDO", "ABERTO")).toBe(false);
    expect(transicaoChamadoValida("RESOLVIDO", "EM_TRATATIVA")).toBe(false);
  });
});

describe("próximos estados do chamado", () => {
  it("lista EM_TRATATIVA como único próximo de ABERTO", () => {
    expect(proximosEstadosChamado("ABERTO")).toEqual(["EM_TRATATIVA"]);
  });
  it("lista AGUARDANDO e RESOLVIDO como próximos de EM_TRATATIVA", () => {
    expect(proximosEstadosChamado("EM_TRATATIVA")).toEqual(["AGUARDANDO", "RESOLVIDO"]);
  });
  it("lista EM_TRATATIVA e RESOLVIDO como próximos de AGUARDANDO", () => {
    expect(proximosEstadosChamado("AGUARDANDO")).toEqual(["EM_TRATATIVA", "RESOLVIDO"]);
  });
  it("trata RESOLVIDO como estado final (sem próximos)", () => {
    expect(proximosEstadosChamado("RESOLVIDO")).toEqual([]);
  });
});

describe("catálogo de estados", () => {
  it("expõe os quatro estados na ordem do fluxo", () => {
    expect(ESTADOS_CHAMADO).toEqual(["ABERTO", "EM_TRATATIVA", "AGUARDANDO", "RESOLVIDO"]);
  });
});
