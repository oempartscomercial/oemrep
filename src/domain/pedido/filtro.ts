import type { EstadoPedido } from "./estado";

export type FiltroPedido = "EM_ANDAMENTO" | "CONCLUIDOS" | "ARQUIVADOS" | "TODOS";

export function filtrarPedidos<T extends { estado: EstadoPedido }>(
  pedidos: T[],
  filtro: FiltroPedido,
): T[] {
  switch (filtro) {
    case "EM_ANDAMENTO":
      return pedidos.filter((p) => p.estado === "SEM_NFE" || p.estado === "PARCIAL");
    case "CONCLUIDOS":
      return pedidos.filter((p) => p.estado === "COMPLETO");
    case "ARQUIVADOS":
      return pedidos.filter((p) => p.estado === "ARQUIVADO");
    case "TODOS":
      return pedidos;
  }
}
