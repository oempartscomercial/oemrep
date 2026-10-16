import { describe, it, expect } from "vitest";
import { finalDoSegredo, mascararSegredo } from "../segredo";

describe("máscara do segredo salvo", () => {
  it("guarda só os 4 últimos caracteres e mostra ••••", () => {
    expect(finalDoSegredo("abcdef1a2b")).toBe("1a2b");
    expect(mascararSegredo("1a2b")).toBe("••••1a2b");
  });

  it("segredo curto não revela quase nada: no máximo metade", () => {
    expect(finalDoSegredo("abcd")).toBe("cd");
    expect(finalDoSegredo("abc")).toBe("c");
    expect(finalDoSegredo("a")).toBe("");
    expect(mascararSegredo("")).toBe("••••");
  });

  it("ignora espaços nas pontas", () => {
    expect(finalDoSegredo("  chave-123456  ")).toBe("3456");
  });
});
