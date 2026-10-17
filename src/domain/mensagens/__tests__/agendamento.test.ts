import { describe, it, expect } from "vitest";
import { descreverMomento, interpretarMomento, quandoPodeSair, validarAgendamento } from "../agendamento";

const sp = (iso: string) => new Date(`${iso}-03:00`);
// Sexta-feira, 16/10/2026, 14h em São Paulo.
const AGORA = sp("2026-10-16T14:00:00");
const JANELA = { inicio: 8, fim: 18 };

describe("interpretarMomento — quando enviar, dito em conversa", () => {
  it("'agora' (ou vazio) é agora", () => {
    expect(interpretarMomento("agora", AGORA, 8)).toEqual({ tipo: "agora" });
    expect(interpretarMomento("  ", AGORA, 8)).toEqual({ tipo: "agora" });
    expect(interpretarMomento("já", AGORA, 8)).toEqual({ tipo: "agora" });
  });

  it("amanhã, hoje e dia da semana, com ou sem hora (sem hora = início do horário comercial)", () => {
    expect(interpretarMomento("amanhã 9h", AGORA, 8)).toEqual({ tipo: "em", quando: sp("2026-10-17T09:00:00") });
    expect(interpretarMomento("amanha às 9:30", AGORA, 8)).toEqual({ tipo: "em", quando: sp("2026-10-17T09:30:00") });
    expect(interpretarMomento("amanhã", AGORA, 8)).toEqual({ tipo: "em", quando: sp("2026-10-17T08:00:00") });
    expect(interpretarMomento("hoje 16h30", AGORA, 8)).toEqual({ tipo: "em", quando: sp("2026-10-16T16:30:00") });
    expect(interpretarMomento("segunda 14h", AGORA, 8)).toEqual({ tipo: "em", quando: sp("2026-10-19T14:00:00") });
    expect(interpretarMomento("segunda-feira às 10h", AGORA, 8)).toEqual({ tipo: "em", quando: sp("2026-10-19T10:00:00") });
    // Hoje é sexta: "sexta 15h" ainda é hoje; "sexta 10h" já passou, vai para a próxima.
    expect(interpretarMomento("sexta 15h", AGORA, 8)).toEqual({ tipo: "em", quando: sp("2026-10-16T15:00:00") });
    expect(interpretarMomento("sexta 10h", AGORA, 8)).toEqual({ tipo: "em", quando: sp("2026-10-23T10:00:00") });
    expect(interpretarMomento("16h", AGORA, 8)).toEqual({ tipo: "em", quando: sp("2026-10-16T16:00:00") });
  });

  it("data e hora: 23/10 9h, 23/10/2026 09:00 e o formato do campo da tela (2026-10-23T09:00)", () => {
    expect(interpretarMomento("23/10 9h", AGORA, 8)).toEqual({ tipo: "em", quando: sp("2026-10-23T09:00:00") });
    expect(interpretarMomento("23/10/2026 09:00", AGORA, 8)).toEqual({ tipo: "em", quando: sp("2026-10-23T09:00:00") });
    expect(interpretarMomento("2026-10-23T09:00", AGORA, 8)).toEqual({ tipo: "em", quando: sp("2026-10-23T09:00:00") });
    expect(interpretarMomento("2026-10-23 09:00", AGORA, 8)).toEqual({ tipo: "em", quando: sp("2026-10-23T09:00:00") });
    expect(interpretarMomento("23/10", AGORA, 8)).toEqual({ tipo: "em", quando: sp("2026-10-23T08:00:00") });
  });

  it("o que não entende devolve nulo (quem chama pergunta, não adivinha)", () => {
    for (const t of ["semana que vem", "31/02 9h", "amanhã 25h", "amanhã 9h70", "depois do almoço"]) expect(interpretarMomento(t, AGORA, 8)).toBeNull();
  });
});

describe("validarAgendamento", () => {
  it("não aceita passado nem mais de 30 dias", () => {
    expect(validarAgendamento(sp("2026-10-16T13:00:00"), AGORA)).toMatch(/já passou/);
    expect(validarAgendamento(sp("2026-11-20T09:00:00"), AGORA)).toMatch(/30 dias/);
    expect(validarAgendamento(sp("2026-10-19T09:00:00"), AGORA)).toBeNull();
  });
});

describe("quandoPodeSair — agendada fora do horário espera a próxima abertura", () => {
  it("dentro do horário sai na hora marcada; fora, na abertura seguinte", () => {
    expect(quandoPodeSair(sp("2026-10-19T09:00:00"), AGORA, JANELA)).toEqual(sp("2026-10-19T09:00:00"));
    expect(quandoPodeSair(sp("2026-10-17T10:00:00"), AGORA, JANELA)).toEqual(sp("2026-10-19T08:00:00")); // sábado → segunda 8h
    expect(quandoPodeSair(sp("2026-10-16T20:00:00"), AGORA, JANELA)).toEqual(sp("2026-10-19T08:00:00")); // sexta à noite
    expect(quandoPodeSair(null, AGORA, JANELA)).toEqual(AGORA);
  });
});

describe("descreverMomento", () => {
  it("dia da semana, data e hora de São Paulo", () => {
    expect(descreverMomento(sp("2026-10-19T09:00:00"))).toBe("segunda, 19/10/2026 às 09:00");
  });
});
