import { describe, it, expect } from "vitest";
import { lerPagina, paginar } from "../paginacao";

describe("paginação", () => {
  it("lê a página da URL, caindo na 1 quando inválida", () => {
    expect(lerPagina(undefined)).toBe(1);
    expect(lerPagina("abc")).toBe(1);
    expect(lerPagina("0")).toBe(1);
    expect(lerPagina("3")).toBe(3);
  });

  it("recorta a lista e trava na última página", () => {
    const lista = Array.from({ length: 120 }, (_, i) => i);
    expect(paginar(lista, 2)).toMatchObject({ pagina: 2, total: 120 });
    expect(paginar(lista, 2).itens[0]).toBe(50);
    expect(paginar(lista, 9).pagina).toBe(3);
    expect(paginar(lista, 9).itens).toHaveLength(20);
    expect(paginar([], 4)).toEqual({ itens: [], pagina: 1, total: 0 });
  });
});
