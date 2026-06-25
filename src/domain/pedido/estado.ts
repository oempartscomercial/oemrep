export type EstadoPedido = "SEM_NFE" | "PARCIAL" | "COMPLETO" | "ARQUIVADO";

const TRANSICOES: Record<EstadoPedido, EstadoPedido[]> = {
  SEM_NFE: ["PARCIAL"],
  PARCIAL: ["COMPLETO"],
  COMPLETO: ["ARQUIVADO"],
  ARQUIVADO: ["COMPLETO"], // reabertura para consulta (RN17)
};

export function transicaoValida(de: EstadoPedido, para: EstadoPedido): boolean {
  return TRANSICOES[de]?.includes(para) ?? false;
}
