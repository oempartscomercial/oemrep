export type EstadoPedido = "SEM_NFE" | "PARCIAL" | "COMPLETO" | "ARQUIVADO";
export type StatusItemPedido = "PENDENTE" | "OK" | "FORA_DE_FABRICACAO" | "DESISTENCIA";

const TRANSICOES: Record<EstadoPedido, EstadoPedido[]> = {
  SEM_NFE: ["PARCIAL"],
  PARCIAL: ["COMPLETO"],
  COMPLETO: ["ARQUIVADO"],
  ARQUIVADO: ["COMPLETO"], // reabertura para consulta (RN17)
};

export function transicaoValida(de: EstadoPedido, para: EstadoPedido): boolean {
  return TRANSICOES[de]?.includes(para) ?? false;
}

const STATUS_QUE_RESOLVEM: StatusItemPedido[] = ["OK", "FORA_DE_FABRICACAO", "DESISTENCIA"];

// ADR-005: itens em FORA_DE_FABRICACAO/DESISTENCIA contam como resolvidos para fins
// de ciclo de vida. Só recalcula PARCIAL<->COMPLETO; SEM_NFE só sai quando a 1ª NFe é
// vinculada (Épico 4) e ARQUIVADO só muda por ação manual de reabertura.
export function recalcularEstado(
  estadoAtual: EstadoPedido,
  itens: { status: StatusItemPedido }[],
): EstadoPedido {
  if (estadoAtual === "SEM_NFE" || estadoAtual === "ARQUIVADO") return estadoAtual;
  const todosResolvidos = itens.every((item) => STATUS_QUE_RESOLVEM.includes(item.status));
  return todosResolvidos ? "COMPLETO" : "PARCIAL";
}
