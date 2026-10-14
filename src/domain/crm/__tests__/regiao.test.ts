import { describe, it, expect } from "vitest";
import { normalizarUf, ufNorteNordeste } from "../regiao";

describe("região da empresa", () => {
  it("normaliza a UF e recusa sigla que não existe", () => {
    expect(normalizarUf(" pe ")).toBe("PE");
    expect(normalizarUf("XX")).toBeNull();
    expect(normalizarUf("")).toBeNull();
  });

  it("Rudolph só no Norte e Nordeste (regra do contrato)", () => {
    for (const uf of ["AC", "AP", "AM", "PA", "RO", "RR", "TO", "AL", "BA", "CE", "MA", "PB", "PE", "PI", "RN", "SE"]) {
      expect(ufNorteNordeste(uf)).toBe(true);
    }
    for (const uf of ["SC", "SP", "GO", "DF", "MG", "RS"]) expect(ufNorteNordeste(uf)).toBe(false);
  });
});
