// Filtros da lista de itens (RF06), lidos da URL. Valor inválido é ignorado em vez
// de quebrar a tela.

export const STATUS_ITEM = ["PENDENTE", "OK", "FORA_DE_FABRICACAO", "DESISTENCIA"] as const;
export type StatusFiltroItem = (typeof STATUS_ITEM)[number] | "TODOS";

export type FiltroItens = {
  fabricaId?: string;
  clienteId?: string;
  mes?: string; // AAAA-MM, mês do pedido
  referencia?: string;
  status: StatusFiltroItem;
  pagina: number;
};

export function lerFiltroItens(params: Record<string, string | undefined>): FiltroItens {
  const filtro: FiltroItens = { status: "PENDENTE", pagina: 1 };
  if (params.fabricaId) filtro.fabricaId = params.fabricaId;
  if (params.clienteId) filtro.clienteId = params.clienteId;
  if (params.mes && /^\d{4}-(0[1-9]|1[0-2])$/.test(params.mes)) filtro.mes = params.mes;
  const referencia = params.referencia?.trim();
  if (referencia) filtro.referencia = referencia;
  if (params.status === "TODOS" || (STATUS_ITEM as readonly string[]).includes(params.status ?? "")) {
    filtro.status = params.status as StatusFiltroItem;
  }
  const pagina = Number(params.pagina);
  if (Number.isInteger(pagina) && pagina > 1) filtro.pagina = pagina;
  return filtro;
}

export function intervaloDoMes(mes: string): { gte: Date; lt: Date } {
  const [ano, m] = mes.split("-").map(Number);
  return { gte: new Date(Date.UTC(ano, m - 1, 1)), lt: new Date(Date.UTC(ano, m, 1)) };
}
