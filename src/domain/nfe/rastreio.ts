export type StatusRastreio = "TRANSITO" | "AGENDADO" | "RECEBIDA" | "ARMAZENADA" | "EXTRAVIADO";

export const STATUS_RASTREIO: StatusRastreio[] = [
  "TRANSITO",
  "AGENDADO",
  "RECEBIDA",
  "ARMAZENADA",
  "EXTRAVIADO",
];

// ADR-008: fluxo logístico da NFe é TRÂNSITO → RECEBIDA → ARMAZENADA, com desvio para
// EXTRAVIADO a partir do trânsito. ARMAZENADA e EXTRAVIADO são estados terminais.
// AGENDADO (planilha do Zé) é uma parada do trânsito: a transportadora marcou a entrega.
const TRANSICOES: Record<StatusRastreio, StatusRastreio[]> = {
  TRANSITO: ["AGENDADO", "RECEBIDA", "EXTRAVIADO"],
  AGENDADO: ["RECEBIDA", "TRANSITO", "EXTRAVIADO"],
  RECEBIDA: ["ARMAZENADA"],
  ARMAZENADA: [],
  EXTRAVIADO: [],
};

export function proximosStatusRastreio(de: StatusRastreio): StatusRastreio[] {
  return TRANSICOES[de] ?? [];
}

export function transicaoRastreioValida(de: StatusRastreio, para: StatusRastreio): boolean {
  return TRANSICOES[de]?.includes(para) ?? false;
}
