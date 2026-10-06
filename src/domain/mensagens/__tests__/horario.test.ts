import { describe, it, expect } from "vitest";
import { dentroDoHorarioComercial, proximaJanelaComercial } from "../horario";

const cfg = { inicio: 8, fim: 18 };
// São Paulo é UTC-3 o ano todo (sem horário de verão desde 2019). 07/10/2026 é quarta.
const sp = (iso: string) => new Date(`${iso}-03:00`);

describe("dentroDoHorarioComercial (seg–sex, America/Sao_Paulo)", () => {
  it("dentro, na quarta de manhã", () => expect(dentroDoHorarioComercial(sp("2026-10-07T10:00:00"), cfg)).toBe(true));
  it("a hora inicial vale, a final não", () => {
    expect(dentroDoHorarioComercial(sp("2026-10-07T08:00:00"), cfg)).toBe(true);
    expect(dentroDoHorarioComercial(sp("2026-10-07T07:59:00"), cfg)).toBe(false);
    expect(dentroDoHorarioComercial(sp("2026-10-07T17:59:00"), cfg)).toBe(true);
    expect(dentroDoHorarioComercial(sp("2026-10-07T18:00:00"), cfg)).toBe(false);
  });
  it("sábado e domingo ficam fora", () => {
    expect(dentroDoHorarioComercial(sp("2026-10-10T12:00:00"), cfg)).toBe(false);
    expect(dentroDoHorarioComercial(sp("2026-10-11T12:00:00"), cfg)).toBe(false);
  });
  it("usa o relógio de São Paulo, não o do servidor (UTC)", () => {
    // 20:30 UTC de quarta = 17:30 em São Paulo
    expect(dentroDoHorarioComercial(new Date("2026-10-07T20:30:00Z"), cfg)).toBe(true);
    // 01:00 UTC de quinta = 22:00 de quarta em São Paulo
    expect(dentroDoHorarioComercial(new Date("2026-10-08T01:00:00Z"), cfg)).toBe(false);
  });
});

describe("proximaJanelaComercial", () => {
  it("já dentro: é agora", () => {
    const agora = sp("2026-10-07T10:00:00");
    expect(proximaJanelaComercial(agora, cfg)).toEqual(agora);
  });
  it("à noite, abre no dia seguinte às 8h", () => {
    expect(proximaJanelaComercial(sp("2026-10-07T21:00:00"), cfg)).toEqual(sp("2026-10-08T08:00:00"));
  });
  it("sexta à noite, abre na segunda", () => {
    expect(proximaJanelaComercial(sp("2026-10-09T18:30:00"), cfg)).toEqual(sp("2026-10-12T08:00:00"));
  });
  it("cedo demais: abre às 8h do mesmo dia", () => {
    expect(proximaJanelaComercial(sp("2026-10-07T06:10:00"), cfg)).toEqual(sp("2026-10-07T08:00:00"));
  });
});
