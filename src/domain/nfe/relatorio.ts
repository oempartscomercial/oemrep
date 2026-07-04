export type LinhaFaturamento = {
  pedidoId: string;
  pedidoNumero: string;
  referencia: string;
  descricao: string;
  quantidadeFaturada: number;
  valorUnitario: number;
};

export type GrupoPedidoFaturamento = {
  pedidoId: string;
  pedidoNumero: string;
  linhas: LinhaFaturamento[];
  totalFaturado: number;
};

// RF17: substitui a aba manual "CRUZAMENTO NF" — agrupa o que uma NFe faturou por
// pedido (uma NFe pode cobrir vários pedidos do mesmo cliente, RN10).
export function agruparCruzamentoPorPedido(linhas: LinhaFaturamento[]): GrupoPedidoFaturamento[] {
  const grupos = new Map<string, GrupoPedidoFaturamento>();

  for (const linha of linhas) {
    if (!grupos.has(linha.pedidoId)) {
      grupos.set(linha.pedidoId, {
        pedidoId: linha.pedidoId,
        pedidoNumero: linha.pedidoNumero,
        linhas: [],
        totalFaturado: 0,
      });
    }
    const grupo = grupos.get(linha.pedidoId)!;
    grupo.linhas.push(linha);
    grupo.totalFaturado += linha.quantidadeFaturada * linha.valorUnitario;
  }

  return [...grupos.values()];
}
