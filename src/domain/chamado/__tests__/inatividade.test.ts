import { describe, it, expect } from "vitest";
import { estaCritico } from "../inatividade";

describe("estaCritico (ADR-006: 30 dias, padrão único global)", () => {
  it("não é crítico com 29 dias sem evento", () => {
    const dataUltimoEvento = new Date("2026-06-01T00:00:00-03:00");
    const hoje = new Date("2026-06-30T00:00:00-03:00");
    expect(estaCritico(dataUltimoEvento, hoje)).toBe(false);
  });

  it("é crítico exatamente aos 30 dias sem evento", () => {
    const dataUltimoEvento = new Date("2026-06-01T00:00:00-03:00");
    const hoje = new Date("2026-07-01T00:00:00-03:00");
    expect(estaCritico(dataUltimoEvento, hoje)).toBe(true);
  });

  it("é crítico com mais de 30 dias sem evento", () => {
    const dataUltimoEvento = new Date("2026-06-01T00:00:00-03:00");
    const hoje = new Date("2026-08-01T00:00:00-03:00");
    expect(estaCritico(dataUltimoEvento, hoje)).toBe(true);
  });

  it("não é crítico logo após um evento (0 dias)", () => {
    const agora = new Date("2026-07-01T00:00:00-03:00");
    expect(estaCritico(agora, agora)).toBe(false);
  });

  it("aceita um prazo customizado (parametrizável)", () => {
    const dataUltimoEvento = new Date("2026-06-01T00:00:00-03:00");
    const hoje = new Date("2026-06-11T00:00:00-03:00");
    expect(estaCritico(dataUltimoEvento, hoje, 10)).toBe(true);
    expect(estaCritico(dataUltimoEvento, hoje, 15)).toBe(false);
  });
});
