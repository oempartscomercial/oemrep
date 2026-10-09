const MS_POR_DIA = 1000 * 60 * 60 * 24;

export type PedidoParaAlerta = {
  id: string;
  numero: string;
  fabrica: string;
  cliente: string;
  estado: string;
  criadoEm: Date;
  /** Data do pedido informada no registro; conta a partir dela quando existe. */
  dataPedido?: Date | null;
  /** Prazo da fábrica (slaDiasSemNota); sem ele vale o padrão global. */
  prazoDias?: number | null;
  /** Quanto falta faturar, para mostrar o alerta em reais. */
  saldo?: number;
  /** Pedido rápido que ainda não recebeu os itens (PDF ou nota). */
  rapidoSemItens?: boolean;
};

export type AlertaSemNfe = {
  pedidoId: string;
  numero: string;
  fabrica: string;
  cliente: string;
  diasSemNfe: number;
  prazoDias: number;
  valor: number;
  rapidoSemItens: boolean;
};

/** Dias corridos desde o pedido (ou desde que entrou no sistema, se não tem data). */
export function diasSemNota(p: Pick<PedidoParaAlerta, "criadoEm" | "dataPedido">, hoje: Date): number {
  const desde = p.dataPedido ?? p.criadoEm;
  return Math.max(0, Math.floor((hoje.getTime() - desde.getTime()) / MS_POR_DIA));
}

// ADR-006: alerta de "pedido sem NFe" dispara após o prazo (padrão global de 7 dias,
// configurável via Parametro "prazo_alerta_sem_nfe_dias"); cada fábrica pode ter o seu.
// Só pedidos em SEM_NFE — PARCIAL/COMPLETO já têm nota.
export function pedidosSemNfeVencidos(
  pedidos: PedidoParaAlerta[],
  hoje: Date,
  prazoDias: number = 7,
): AlertaSemNfe[] {
  return pedidos
    .filter((p) => p.estado === "SEM_NFE")
    .map((p) => ({ pedido: p, diasSemNfe: diasSemNota(p, hoje), prazo: p.prazoDias ?? prazoDias }))
    .filter(({ diasSemNfe, prazo }) => diasSemNfe >= prazo)
    .sort((a, b) => b.diasSemNfe - a.diasSemNfe)
    .map(({ pedido, diasSemNfe, prazo }) => ({
      pedidoId: pedido.id,
      numero: pedido.numero,
      fabrica: pedido.fabrica,
      cliente: pedido.cliente,
      diasSemNfe,
      prazoDias: prazo,
      valor: pedido.saldo ?? 0,
      rapidoSemItens: pedido.rapidoSemItens ?? false,
    }));
}
