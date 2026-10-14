// Quem parou de comprar, pela planilha de pedidos recebidos (PedidoHistorico). Mesma conta da
// ferramenta local do Rômulo (rep/ferramentas/crm.py), para os números baterem nos dois lados.
// São sinais para conferir, não previsão (ADR-013): pedido recebido não é faturamento, e a
// planilha cobre só 2026.

export type CompraDaCarteira = {
  clienteId: string;
  /** "AAAA-MM-DD" */
  data: string;
  valor: number;
  fabrica: string;
  /** A planilha trazia dia 1: a data pode ser só o mês. */
  dataSoMes: boolean;
};

export type EstadoCarteira = "atrasado" | "em_dia" | "sumiu" | "recente";

export type ClienteNaCarteira = {
  clienteId: string;
  valor: number;
  pedidos: number;
  /** Datas distintas de compra. */
  compras: number;
  ultimaCompra: string;
  ultimaAproximada: boolean;
  diasSemComprar: number;
  /** Mediana dos intervalos entre compras; null com menos de 3 datas. */
  ritmoDias: number | null;
  estado: EstadoCarteira;
  porFabrica: Record<string, number>;
};

/** Mínimo de dias sem comprar para um cliente com ritmo ser considerado atrasado. */
export const MINIMO_ATRASO_DIAS = 45;
/** Cliente de 1 ou 2 compras "não voltou" depois disto. */
export const DIAS_PARA_SUMIR = 60;

export const COMO_FOI_CALCULADO =
  "'Atrasado' = cliente com 3 ou mais datas de compra que está há mais que o dobro do seu intervalo normal " +
  `(mínimo ${MINIMO_ATRASO_DIAS} dias) sem pedir. 'Não voltou' = 1 ou 2 compras e mais de ${DIAS_PARA_SUMIR} dias sem pedir. ` +
  "São sinais para conferir, não certeza de cliente perdido.";

const DIA = 86_400_000;
const dias = (de: string, ate: string) => Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / DIA);
const centavos = (v: number) => Math.round(v * 100) / 100;

function mediana(valores: number[]): number {
  const ordenados = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(ordenados.length / 2);
  return ordenados.length % 2 ? ordenados[meio] : (ordenados[meio - 1] + ordenados[meio]) / 2;
}

export function analisarCarteira(compras: CompraDaCarteira[], hoje: string): ClienteNaCarteira[] {
  const porCliente = new Map<string, CompraDaCarteira[]>();
  for (const c of compras) porCliente.set(c.clienteId, [...(porCliente.get(c.clienteId) ?? []), c]);

  const resultado: ClienteNaCarteira[] = [];
  for (const [clienteId, lista] of porCliente) {
    const datas = [...new Set(lista.map((c) => c.data))].sort();
    const ultima = datas[datas.length - 1];
    const diasSemComprar = dias(ultima, hoje);
    const intervalos = datas.slice(1).map((d, i) => dias(datas[i], d));
    const ritmo = intervalos.length >= 2 ? mediana(intervalos) : null;
    const estado: EstadoCarteira = ritmo
      ? diasSemComprar > Math.max(2 * ritmo, MINIMO_ATRASO_DIAS)
        ? "atrasado"
        : "em_dia"
      : diasSemComprar > DIAS_PARA_SUMIR
        ? "sumiu"
        : "recente";
    const porFabrica: Record<string, number> = {};
    for (const c of lista) porFabrica[c.fabrica] = centavos((porFabrica[c.fabrica] ?? 0) + c.valor);
    resultado.push({
      clienteId,
      valor: centavos(lista.reduce((s, c) => s + c.valor, 0)),
      pedidos: lista.length,
      compras: datas.length,
      ultimaCompra: ultima,
      ultimaAproximada: lista.some((c) => c.data === ultima && c.dataSoMes),
      diasSemComprar,
      ritmoDias: ritmo,
      estado,
      porFabrica,
    });
  }
  return resultado.sort((a, b) => b.valor - a.valor);
}
