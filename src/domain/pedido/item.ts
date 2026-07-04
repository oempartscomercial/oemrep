import type { StatusItemPedido } from "./estado";

export type ItemPedidoCalculo = {
  quantidadePedida: number;
  quantidadeFaturada: number;
};

export function calcularQtdPendente(item: ItemPedidoCalculo): number {
  return item.quantidadePedida - item.quantidadeFaturada;
}

const STATUS_QUE_CONGELAM: StatusItemPedido[] = ["FORA_DE_FABRICACAO", "DESISTENCIA"];

// ADR-008: ao resolver um item por não-faturamento, grava-se o saldo pendente daquele
// instante. Só congela na transição de ENTRADA nesses status, não a cada troca entre
// eles.
export function deveCongelarPendencia(
  statusAnterior: StatusItemPedido,
  statusNovo: StatusItemPedido,
): boolean {
  return STATUS_QUE_CONGELAM.includes(statusNovo) && !STATUS_QUE_CONGELAM.includes(statusAnterior);
}
