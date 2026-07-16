// Lógica pura de mapeamento estado do domínio → rótulo + cor de badge.
// Mantida separada do componente para ser testável sem React (TDD, ADR-011).

export type StatusTipo = "pedido" | "nfe" | "chamado";
export type StatusBadgeColor = "gray" | "success" | "warning" | "error" | "blue";

const MAPA: Record<StatusTipo, Record<string, { label: string; color: StatusBadgeColor }>> = {
  pedido: {
    SEM_NFE: { label: "Sem NFe", color: "gray" },
    PARCIAL: { label: "Parcial", color: "warning" },
    COMPLETO: { label: "Completo", color: "success" },
    ARQUIVADO: { label: "Arquivado", color: "gray" },
  },
  nfe: {
    TRANSITO: { label: "Em trânsito", color: "blue" },
    RECEBIDA: { label: "Recebida", color: "warning" },
    ARMAZENADA: { label: "Armazenada", color: "success" },
    EXTRAVIADO: { label: "Extraviado", color: "error" },
  },
  chamado: {
    ABERTO: { label: "Aberto", color: "blue" },
    EM_TRATATIVA: { label: "Em tratativa", color: "warning" },
    AGUARDANDO: { label: "Aguardando", color: "warning" },
    RESOLVIDO: { label: "Resolvido", color: "success" },
  },
};

export function statusBadgeConfig(
  tipo: StatusTipo,
  valor: string,
): { label: string; color: StatusBadgeColor } {
  return MAPA[tipo]?.[valor] ?? { label: valor, color: "gray" };
}
