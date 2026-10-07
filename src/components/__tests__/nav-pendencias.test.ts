import { describe, it, expect } from "vitest";
import { formatarSeloPendencias } from "../nav-pendencias";

describe("formatarSeloPendencias (selo de Conversas no menu)", () => {
  it("sem pendência, ou sem contagem disponível, não mostra selo", () => {
    expect(formatarSeloPendencias(0)).toBeNull();
    expect(formatarSeloPendencias(null)).toBeNull();
    expect(formatarSeloPendencias(undefined)).toBeNull();
  });

  it("um número, com rótulo no singular", () => {
    expect(formatarSeloPendencias(1)).toEqual({ texto: "1", rotulo: "1 pendência" });
  });

  it("vários números, com rótulo no plural", () => {
    expect(formatarSeloPendencias(3)).toEqual({ texto: "3", rotulo: "3 pendências" });
  });

  it("99 aparece como 99", () => {
    expect(formatarSeloPendencias(99)).toEqual({ texto: "99", rotulo: "99 pendências" });
  });

  it("acima de 99 vira 99+, e o rótulo fala em mais de 99", () => {
    expect(formatarSeloPendencias(100)).toEqual({ texto: "99+", rotulo: "mais de 99 pendências" });
    expect(formatarSeloPendencias(1234)).toEqual({ texto: "99+", rotulo: "mais de 99 pendências" });
  });
});
