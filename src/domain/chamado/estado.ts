export type EstadoChamado = "ABERTO" | "EM_TRATATIVA" | "AGUARDANDO" | "RESOLVIDO";

export const ESTADOS_CHAMADO: EstadoChamado[] = [
  "ABERTO",
  "EM_TRATATIVA",
  "AGUARDANDO",
  "RESOLVIDO",
];

// ADR-004: chamado nasce ABERTO. Fluxo: ABERTO → EM_TRATATIVA → {AGUARDANDO, RESOLVIDO};
// AGUARDANDO pode voltar para EM_TRATATIVA (resposta chegou) ou avançar para RESOLVIDO.
// RESOLVIDO é terminal no MVP — reabertura não é um RF do Épico 6.
const TRANSICOES: Record<EstadoChamado, EstadoChamado[]> = {
  ABERTO: ["EM_TRATATIVA"],
  EM_TRATATIVA: ["AGUARDANDO", "RESOLVIDO"],
  AGUARDANDO: ["EM_TRATATIVA", "RESOLVIDO"],
  RESOLVIDO: [],
};

export function proximosEstadosChamado(de: EstadoChamado): EstadoChamado[] {
  return TRANSICOES[de] ?? [];
}

export function transicaoChamadoValida(de: EstadoChamado, para: EstadoChamado): boolean {
  return TRANSICOES[de]?.includes(para) ?? false;
}
