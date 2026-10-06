// Horário comercial da linha de prospecção (ADR-015 §4): seg–sex, no relógio de São Paulo.
// Sem horário de verão desde 2019, então o deslocamento é sempre de horas inteiras.

const FUSO = "America/Sao_Paulo";
const HORA_MS = 3_600_000;
const formato = new Intl.DateTimeFormat("en-US", { timeZone: FUSO, weekday: "short", hour: "numeric", hourCycle: "h23" });

export type JanelaComercial = { inicio: number; fim: number };

export function dentroDoHorarioComercial(d: Date, janela: JanelaComercial): boolean {
  const partes = Object.fromEntries(formato.formatToParts(d).map((p) => [p.type, p.value]));
  if (partes.weekday === "Sat" || partes.weekday === "Sun") return false;
  const hora = Number(partes.hour);
  return hora >= janela.inicio && hora < janela.fim;
}

/** O primeiro instante em que dá para enviar: agora, se já está na janela; senão a próxima abertura. */
export function proximaJanelaComercial(agora: Date, janela: JanelaComercial): Date | null {
  if (dentroDoHorarioComercial(agora, janela)) return agora;
  let t = Math.ceil(agora.getTime() / HORA_MS) * HORA_MS;
  for (let i = 0; i < 24 * 8; i++, t += HORA_MS) {
    if (dentroDoHorarioComercial(new Date(t), janela)) return new Date(t);
  }
  return null;
}
