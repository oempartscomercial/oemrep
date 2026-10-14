import { describe, it, expect } from "vitest";
import { nomeParecido } from "../duplicidade";

describe("nomeParecido (antes de cadastrar empresa nova)", () => {
  it("acha quando um nome contém o outro como palavra inteira, ignorando acento e caixa", () => {
    expect(nomeParecido("Real Trator Peças", "REAL TRATOR")).toBe(true);
    expect(nomeParecido("dispet", "Dispetral Distribuidora")).toBe(true);
    expect(nomeParecido("Peças São João", "pecas sao joao ltda")).toBe(true);
  });

  it("não acha por pedaço solto no meio da palavra nem por nome curto demais", () => {
    expect(nomeParecido("Fortgiro", "Giro Peças")).toBe(false);
    expect(nomeParecido("BR Transmissões", "AB")).toBe(false);
    expect(nomeParecido("Tratorpeças Norte", "Cyro")).toBe(false);
  });
});
