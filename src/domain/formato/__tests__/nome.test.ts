import { describe, it, expect } from "vitest";
import { iniciais } from "../nome";

describe("iniciais", () => {
  it("duas palavras viram duas letras, ignorando conectivos", () => {
    expect(iniciais("Ditrac Agrícola Parts")).toBe("DA");
    expect(iniciais("Casa do Trator")).toBe("CT");
    expect(iniciais("arthur brito")).toBe("AB");
  });
  it("uma palavra vira uma letra; vazio vira '?'", () => {
    expect(iniciais("Rômulo")).toBe("R");
    expect(iniciais("  ")).toBe("?");
  });
  it("ignora pontuação e números soltos", () => {
    expect(iniciais("BR TRANSMISSÕES LTDA.")).toBe("BT");
    expect(iniciais("3M & Cia")).toBe("3C");
  });
});
