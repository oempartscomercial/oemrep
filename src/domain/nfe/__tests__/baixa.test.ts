import { describe, it, expect } from "vitest";
import { aplicarBaixaItem } from "../baixa";

describe("aplicarBaixaItem (RF09/RN11)", () => {
  it("marca OK quando a baixa completa a quantidade pedida", () => {
    const resultado = aplicarBaixaItem(
      { quantidadePedida: 10, quantidadeFaturada: 0, status: "PENDENTE" },
      10,
    );
    expect(resultado).toEqual({ quantidadeFaturada: 10, status: "OK" });
  });

  it("mantém PENDENTE quando a baixa é parcial", () => {
    const resultado = aplicarBaixaItem(
      { quantidadePedida: 10, quantidadeFaturada: 0, status: "PENDENTE" },
      4,
    );
    expect(resultado).toEqual({ quantidadeFaturada: 4, status: "PENDENTE" });
  });

  it("soma progressivamente quando já havia faturamento anterior de outra NFe", () => {
    const primeira = aplicarBaixaItem(
      { quantidadePedida: 10, quantidadeFaturada: 0, status: "PENDENTE" },
      4,
    );
    const segunda = aplicarBaixaItem(
      { quantidadePedida: 10, quantidadeFaturada: primeira.quantidadeFaturada, status: primeira.status },
      6,
    );
    expect(segunda).toEqual({ quantidadeFaturada: 10, status: "OK" });
  });

  it("não altera o status de item já resolvido por FORA_DE_FABRICACAO (ADR-005)", () => {
    const resultado = aplicarBaixaItem(
      { quantidadePedida: 10, quantidadeFaturada: 6, status: "FORA_DE_FABRICACAO" },
      2,
    );
    expect(resultado).toEqual({ quantidadeFaturada: 8, status: "FORA_DE_FABRICACAO" });
  });

  it("não altera o status de item já resolvido por DESISTENCIA (ADR-005)", () => {
    const resultado = aplicarBaixaItem(
      { quantidadePedida: 10, quantidadeFaturada: 0, status: "DESISTENCIA" },
      10,
    );
    expect(resultado).toEqual({ quantidadeFaturada: 10, status: "DESISTENCIA" });
  });
});
