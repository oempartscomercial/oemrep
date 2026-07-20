export type PontoMensal = {
  mes: string; // "AAAA-MM"
  valorPedido: number;
  valorNfe: number;
};

export type PedidoParaTotais = {
  criadoEm: Date;
  itens: { quantidadePedida: number; valorUnitario: number }[];
};

export type NotaParaTotais = {
  dataEmissao: Date;
  totalNota: number;
};

export type HistoricoMensalRow = {
  ano: number;
  mes: number;
  tipo: "PEDIDO" | "NFE";
  valor: number;
};

function chaveMes(data: Date): string {
  const ano = data.getUTCFullYear();
  const mes = String(data.getUTCMonth() + 1).padStart(2, "0");
  return `${ano}-${mes}`;
}

function chaveMesNumeros(ano: number, mes: number): string {
  return `${ano}-${String(mes).padStart(2, "0")}`;
}

function ponto(mapa: Map<string, PontoMensal>, mes: string): PontoMensal {
  const existente = mapa.get(mes);
  if (existente) return existente;
  const novo = { mes, valorPedido: 0, valorNfe: 0 };
  mapa.set(mes, novo);
  return novo;
}

export function calcularTotaisMensaisAoVivo(
  pedidos: PedidoParaTotais[],
  notas: NotaParaTotais[],
): PontoMensal[] {
  const mapa = new Map<string, PontoMensal>();

  for (const pedido of pedidos) {
    const valor = pedido.itens.reduce((soma, i) => soma + i.quantidadePedida * i.valorUnitario, 0);
    ponto(mapa, chaveMes(pedido.criadoEm)).valorPedido += valor;
  }
  for (const nota of notas) {
    ponto(mapa, chaveMes(nota.dataEmissao)).valorNfe += nota.totalNota;
  }

  return [...mapa.values()].sort((a, b) => a.mes.localeCompare(b.mes));
}

export function combinarSeries(
  historico: HistoricoMensalRow[],
  aoVivo: PontoMensal[],
): PontoMensal[] {
  const mapa = new Map<string, PontoMensal>();

  for (const linha of historico) {
    const p = ponto(mapa, chaveMesNumeros(linha.ano, linha.mes));
    if (linha.tipo === "PEDIDO") p.valorPedido += linha.valor;
    else p.valorNfe += linha.valor;
  }
  for (const p of aoVivo) {
    const alvo = ponto(mapa, p.mes);
    alvo.valorPedido += p.valorPedido;
    alvo.valorNfe += p.valorNfe;
  }

  return [...mapa.values()].sort((a, b) => a.mes.localeCompare(b.mes));
}
