import { describe, it, expect } from "vitest";
import { segredoConfere, segredoDaRequisicao } from "../segredo";

const SEGREDO = "um-segredo-bem-comprido-123";

describe("segredoConfere", () => {
  it("aceita só o segredo exato", () => {
    expect(segredoConfere(SEGREDO, SEGREDO)).toBe(true);
    expect(segredoConfere(SEGREDO + "x", SEGREDO)).toBe(false);
    expect(segredoConfere("", SEGREDO)).toBe(false);
    expect(segredoConfere(null, SEGREDO)).toBe(false);
  });

  it("sem segredo configurado, ou curto demais, nada passa", () => {
    expect(segredoConfere("", "")).toBe(false);
    expect(segredoConfere("abc", "abc")).toBe(false);
    expect(segredoConfere("qualquer", undefined)).toBe(false);
  });
});

describe("segredoDaRequisicao", () => {
  const req = (url: string, headers: Record<string, string> = {}) => new Request(url, { headers });

  it("lê do cabeçalho x-webhook-secret, do Bearer ou da URL", () => {
    expect(segredoDaRequisicao(req("http://x/w", { "x-webhook-secret": "a" }))).toBe("a");
    expect(segredoDaRequisicao(req("http://x/w", { authorization: "Bearer b" }))).toBe("b");
    expect(segredoDaRequisicao(req("http://x/w?segredo=c"))).toBe("c");
  });

  it("sem nada, devolve nulo", () => {
    expect(segredoDaRequisicao(req("http://x/w"))).toBeNull();
    expect(segredoDaRequisicao(req("http://x/w", { authorization: "Basic zzz" }))).toBeNull();
  });
});
