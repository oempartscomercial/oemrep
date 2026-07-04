import type { StatusItemPedido } from "../pedido/estado";

export type ItemParaBaixa = {
  quantidadePedida: number;
  quantidadeFaturada: number;
  status: StatusItemPedido;
};

export type ResultadoBaixa = {
  quantidadeFaturada: number;
  status: StatusItemPedido;
};

// RF09/RN11: cada baixa soma à quantidade já faturada (baixa parcial progressiva por
// várias NFes). ADR-005: item já resolvido por não-faturamento não volta a mudar de
// status ao receber uma baixa (mas a quantidade é registrada para histórico).
export function aplicarBaixaItem(item: ItemParaBaixa, quantidadeNestaBaixa: number): ResultadoBaixa {
  const quantidadeFaturada = item.quantidadeFaturada + quantidadeNestaBaixa;

  if (item.status === "FORA_DE_FABRICACAO" || item.status === "DESISTENCIA") {
    return { quantidadeFaturada, status: item.status };
  }

  const status: StatusItemPedido = quantidadeFaturada >= item.quantidadePedida ? "OK" : "PENDENTE";
  return { quantidadeFaturada, status };
}
