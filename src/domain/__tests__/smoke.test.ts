import { describe, it, expect } from "vitest";
import { somaConferida } from "../smoke";

describe("infra de testes", () => {
  it("soma dois valores (prova que o TDD está montado)", () => {
    expect(somaConferida(2, 3)).toBe(5);
  });
});
