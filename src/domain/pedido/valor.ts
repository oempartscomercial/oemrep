import type { EstadoPedido, StatusItemPedido } from "./estado";

/**
 * Valores de um pedido para a lista e o painel. Um pedido com itens vale a soma dos itens;
 * um pedido rápido (sem itens) vale o total declarado no registro.
 */
type ItemValor = {
  quantidadePedida: number;
  quantidadeFaturada: number;
  valorUnitario: number | { toString(): string };
  status: StatusItemPedido;
};

export type PedidoValor = {
  estado: EstadoPedido;
  itens: ItemValor[];
  valorTotalDeclarado: number | { toString(): string } | null;
};

const num = (v: number | { toString(): string } | null | undefined) => (v === null || v === undefined ? 0 : Number(v));
const centavos = (v: number) => Math.round(v * 100) / 100;

export function valorDoPedido(p: PedidoValor): number {
  if (p.itens.length === 0) return centavos(num(p.valorTotalDeclarado));
  return centavos(p.itens.reduce((soma, i) => soma + i.quantidadePedida * num(i.valorUnitario), 0));
}

/**
 * Quanto ainda falta a fábrica faturar. Item resolvido sem faturamento (fora de fabricação,
 * desistência) não conta: a fábrica não vai mandar. Pedido arquivado ou completo: zero.
 */
export function saldoAFaturar(p: PedidoValor): number {
  if (p.estado === "COMPLETO" || p.estado === "ARQUIVADO") return 0;
  if (p.itens.length === 0) return p.estado === "SEM_NFE" ? centavos(num(p.valorTotalDeclarado)) : 0;
  return centavos(
    p.itens
      .filter((i) => i.status === "PENDENTE")
      .reduce((soma, i) => soma + Math.max(0, i.quantidadePedida - i.quantidadeFaturada) * num(i.valorUnitario), 0),
  );
}

/** Dias corridos desde o pedido (ou desde que entrou no sistema, se não tem data). */
export function diasDesde(data: Date, agora: Date = new Date()): number {
  return Math.max(0, Math.floor((agora.getTime() - data.getTime()) / (24 * 60 * 60 * 1000)));
}
