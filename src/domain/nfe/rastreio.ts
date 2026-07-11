export type StatusRastreio = "TRANSITO" | "RECEBIDA" | "ARMAZENADA" | "EXTRAVIADO";

export const STATUS_RASTREIO: StatusRastreio[] = [
  "TRANSITO",
  "RECEBIDA",
  "ARMAZENADA",
  "EXTRAVIADO",
];

// ADR-008: fluxo logístico da NFe é TRÂNSITO → RECEBIDA → ARMAZENADA, com desvio para
// EXTRAVIADO a partir do trânsito. ARMAZENADA e EXTRAVIADO são estados terminais.
const TRANSICOES: Record<StatusRastreio, StatusRastreio[]> = {
  TRANSITO: ["RECEBIDA", "EXTRAVIADO"],
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
