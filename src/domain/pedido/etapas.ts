// Ciclo de vida do pedido para o indicador de etapas do detalhe (RF08, ADR-005/008).
export type EstadoPedidoEtapa = "SEM_NFE" | "PARCIAL" | "COMPLETO" | "ARQUIVADO";

const ORDEM: { estado: EstadoPedidoEtapa; rotulo: string }[] = [
  { estado: "SEM_NFE", rotulo: "Sem NFe" },
  { estado: "PARCIAL", rotulo: "Faturamento parcial" },
  { estado: "COMPLETO", rotulo: "Completo" },
  { estado: "ARQUIVADO", rotulo: "Arquivado" },
];

export function etapasDoPedido(estado: EstadoPedidoEtapa) {
  const atual = ORDEM.findIndex((e) => e.estado === estado);
  return ORDEM.map((e, i) => ({
    rotulo: e.rotulo,
    situacao: i < atual ? ("feita" as const) : i === atual ? ("atual" as const) : ("futura" as const),
  }));
}
