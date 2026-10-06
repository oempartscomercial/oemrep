export type ItemPedidoGap = { quantidadePedida: number; valorUnitario: number };
export type ItemFaturadoGap = { quantidadeFaturada: number; valorUnitario: number };

export type PedidoParaGap = {
  fabrica: string;
  cliente: string;
  criadoEm: Date;
  itens: ItemPedidoGap[];
  itensFaturados: ItemFaturadoGap[];
};

export type LinhaGap = {
  mes: string; // "AAAA-MM"
  fabrica: string;
  cliente: string;
  valorPedido: number;
  valorFaturado: number;
  gap: number;
};

function chaveMes(data: Date): string {
  const ano = data.getUTCFullYear();
  const mes = String(data.getUTCMonth() + 1).padStart(2, "0");
  return `${ano}-${mes}`;
}

// ADR-007: gap compara valor de PRODUTOS do pedido × valor de PRODUTOS faturado
// (valorUnitario é preço de produto, sem frete/imposto). Item a item, para atribuir
// corretamente quando uma NFe cobre vários pedidos (RN10).
export function calcularGap(pedidos: PedidoParaGap[]): LinhaGap[] {
  const grupos = new Map<string, LinhaGap>();

  for (const pedido of pedidos) {
    const mes = chaveMes(pedido.criadoEm);
    const chave = `${mes}|${pedido.fabrica}|${pedido.cliente}`;

    const valorPedido = pedido.itens.reduce((soma, i) => soma + i.quantidadePedida * i.valorUnitario, 0);
    const valorFaturado = pedido.itensFaturados.reduce((soma, f) => soma + f.quantidadeFaturada * f.valorUnitario, 0);

    if (!grupos.has(chave)) {
      grupos.set(chave, { mes, fabrica: pedido.fabrica, cliente: pedido.cliente, valorPedido: 0, valorFaturado: 0, gap: 0 });
    }
    const linha = grupos.get(chave)!;
    linha.valorPedido += valorPedido;
    linha.valorFaturado += valorFaturado;
    linha.gap = linha.valorPedido - linha.valorFaturado;
  }

  return [...grupos.values()].sort((a, b) => {
    if (a.mes !== b.mes) return b.mes.localeCompare(a.mes); // mês desc
    if (a.fabrica !== b.fabrica) return a.fabrica.localeCompare(b.fabrica);
    return a.cliente.localeCompare(b.cliente);
  });
}

export type FiltroGap = { fabrica?: string; cliente?: string; ano?: string; mes?: string };

export function filtrarGap(linhas: LinhaGap[], filtro: FiltroGap): LinhaGap[] {
  return linhas.filter(
    (l) =>
      (!filtro.fabrica || l.fabrica === filtro.fabrica) &&
      (!filtro.cliente || l.cliente === filtro.cliente) &&
      (!filtro.ano || l.mes.startsWith(`${filtro.ano}-`)) &&
      (!filtro.mes || l.mes === filtro.mes),
  );
}

export type TotalAnual = { ano: string; valorPedido: number; valorFaturado: number; gap: number };

// RN21: o confronto é por mês e ano, com total anual. Ano mais recente primeiro.
export function totaisPorAno(linhas: LinhaGap[]): TotalAnual[] {
  const anos = new Map<string, TotalAnual>();
  for (const l of linhas) {
    const ano = l.mes.slice(0, 4);
    const total = anos.get(ano) ?? { ano, valorPedido: 0, valorFaturado: 0, gap: 0 };
    total.valorPedido += l.valorPedido;
    total.valorFaturado += l.valorFaturado;
    total.gap = total.valorPedido - total.valorFaturado;
    anos.set(ano, total);
  }
  return [...anos.values()].sort((a, b) => b.ano.localeCompare(a.ano));
}
