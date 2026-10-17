"use client";

import { CampoTexto } from "@/components/patterns/campo";

const FUSO = "America/Sao_Paulo";

/** "AAAA-MM-DDTHH:MM" do próximo dia útil às 9h no relógio de São Paulo: o valor inicial do campo. */
export function proximoDiaUtilAsNove(agora: number): string {
  for (let i = 1; i <= 7; i++) {
    const d = new Date(agora + i * 86_400_000);
    const semana = d.toLocaleDateString("en-US", { timeZone: FUSO, weekday: "short" });
    if (semana !== "Sat" && semana !== "Sun") return `${d.toLocaleDateString("sv-SE", { timeZone: FUSO })}T09:00`;
  }
  return `${new Date(agora + 86_400_000).toLocaleDateString("sv-SE", { timeZone: FUSO })}T09:00`;
}

/**
 * Data e hora para a mensagem aprovada sair (horário de Brasília). O servidor interpreta o valor
 * no fuso de São Paulo, seja qual for o fuso do navegador, e respeita o horário comercial.
 */
export function CampoAgendamento({ valor, aoMudar, id = "agendar-para" }: { valor: string; aoMudar: (v: string) => void; id?: string }) {
  return (
    <CampoTexto
      id={id}
      rotulo="Enviar em (horário de Brasília)"
      type="datetime-local"
      value={valor}
      onChange={(e) => aoMudar(e.target.value)}
      dica="Fora do horário comercial, ela sai na abertura seguinte. Até 30 dias à frente."
    />
  );
}
