"use client";

import { CampoTexto } from "@/components/patterns/campo";

const FUSO = "America/Sao_Paulo";

/** "AAAA-MM-DDTHH:MM" de amanhã às 9h no relógio de São Paulo: o valor inicial do campo. */
export function amanhaAsNove(agora: number): string {
  const dia = new Date(agora + 86_400_000).toLocaleDateString("sv-SE", { timeZone: FUSO });
  return `${dia}T09:00`;
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
