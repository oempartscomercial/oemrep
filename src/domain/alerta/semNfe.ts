const MS_POR_DIA = 1000 * 60 * 60 * 24;

export type PedidoParaAlerta = {
  id: string;
  numero: string;
  fabrica: string;
  cliente: string;
  estado: string;
  criadoEm: Date;
};

export type AlertaSemNfe = {
  pedidoId: string;
  numero: string;
  fabrica: string;
  cliente: string;
  diasSemNfe: number;
};

// ADR-006: alerta de "pedido sem NFe" dispara após 7 dias (padrão único e global,
// configurável via Parametro "prazo_alerta_sem_nfe_dias"). Só pedidos em SEM_NFE —
// PARCIAL/COMPLETO já têm nota.
export function pedidosSemNfeVencidos(
  pedidos: PedidoParaAlerta[],
  hoje: Date,
  prazoDias: number = 7,
): AlertaSemNfe[] {
  return pedidos
    .filter((p) => p.estado === "SEM_NFE")
    .map((p) => ({
      pedido: p,
      diasSemNfe: Math.floor((hoje.getTime() - p.criadoEm.getTime()) / MS_POR_DIA),
    }))
    .filter(({ diasSemNfe }) => diasSemNfe >= prazoDias)
    .sort((a, b) => b.diasSemNfe - a.diasSemNfe)
    .map(({ pedido, diasSemNfe }) => ({
      pedidoId: pedido.id,
      numero: pedido.numero,
      fabrica: pedido.fabrica,
      cliente: pedido.cliente,
      diasSemNfe,
    }));
}
