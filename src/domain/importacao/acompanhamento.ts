import type { EstadoPedido, StatusItemPedido } from "@/domain/pedido/estado";

/**
 * Planilha de acompanhamento que o Zé mantém por fábrica (AUTOFLEX/BOWDEN/RUDOLPH/SEINECA -
 * COMPACTADA): uma linha por item de pedido, com CNPJ e fantasia do cliente, mês do pedido,
 * número, referência, quantidade pedida e pendente, valor unitário e situação.
 *
 * O importador traz só os pedidos que ainda têm saldo (algum item PENDENTE com quantidade
 * pendente). O histórico já faturado fica na planilha.
 */

export type LinhaAcompanhamento = {
  cnpj: string;
  fantasia: string;
  dataPedido: Date | null;
  /** null quando a planilha diz S/NUMERO. */
  numero: string | null;
  referencia: string;
  quantidadePedida: number;
  quantidadePendente: number;
  valorUnitario: number;
  situacao: StatusItemPedido;
};

export type ItemImportado = {
  referencia: string;
  quantidadePedida: number;
  quantidadeFaturada: number;
  valorUnitario: number;
  status: StatusItemPedido;
};

export type PedidoImportado = {
  chave: string;
  cnpj: string;
  fantasia: string;
  numero: string | null;
  dataPedido: Date | null;
  estado: EstadoPedido;
  itens: ItemImportado[];
  saldo: number;
};

export type ClienteImportado = { cnpj: string; nomeFantasia: string; uf: string | null };

const UFS = new Set("AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" "));

/** Raiz de CNPJ da Auto Peças Padre Cícero, a rede que a planilha chama de FILIAL-xx (vista nas DANFEs da Autoflex). */
export const RAIZ_CNPJ_PADRE_CICERO = "07965809";

export function normalizarTexto(texto: string): string {
  return texto.trim().toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ");
}

export function lerSituacao(bruto: string): StatusItemPedido | null {
  const s = normalizarTexto(bruto);
  if (s === "OK") return "OK";
  if (s.startsWith("PENDENTE")) return "PENDENTE";
  if (s.startsWith("FORA DE FABRICA")) return "FORA_DE_FABRICACAO";
  if (s.startsWith("DESISTENCIA")) return "DESISTENCIA";
  return null;
}

/** CNPJ vem como número no Excel e perde o zero à esquerda. */
export function lerCnpj(bruto: unknown): string | null {
  const digitos = String(bruto ?? "").replace(/\D/g, "");
  if (!digitos || digitos.length > 14) return null;
  return digitos.padStart(14, "0");
}

export function lerNumeroPedido(bruto: unknown): string | null {
  const texto = String(bruto ?? "").trim();
  if (!texto || /^S\s*\/?\s*N/i.test(texto)) return null;
  return texto;
}

/** Nome do cliente no sistema: a filial ganha o nome da rede, o resto fica como o Zé escreve. */
export function nomeDoCliente(cnpj: string, fantasia: string): ClienteImportado {
  const nome = fantasia.trim().replace(/\s+/g, " ");
  const uf = nome.match(/\s-\s([A-Z]{2})$/)?.[1] ?? null;
  const ehPadreCicero = cnpj.startsWith(RAIZ_CNPJ_PADRE_CICERO);
  return {
    cnpj,
    nomeFantasia: ehPadreCicero && /^FILIAL/i.test(nome) ? `PADRE CÍCERO ${nome.toUpperCase()}` : nome,
    uf: uf && UFS.has(uf) ? uf : null,
  };
}

const centavos = (v: number) => Math.round(v * 100) / 100;
const mesDe = (d: Date | null) => (d ? d.toISOString().slice(0, 7) : "sem-data");

/**
 * Agrupa as linhas em pedidos e devolve só os que têm saldo. Pedido numerado agrupa por
 * cliente + número; S/NUMERO agrupa por cliente + mês do pedido (é como a planilha separa).
 */
export function pedidosEmAberto(linhas: LinhaAcompanhamento[]): PedidoImportado[] {
  const grupos = new Map<string, LinhaAcompanhamento[]>();
  for (const l of linhas) {
    const chave = `${l.cnpj}|${l.numero ?? `S/N ${mesDe(l.dataPedido)}`}`;
    const g = grupos.get(chave) ?? [];
    g.push(l);
    grupos.set(chave, g);
  }

  const pedidos: PedidoImportado[] = [];
  for (const [chave, g] of grupos) {
    const temSaldo = g.some((l) => l.situacao === "PENDENTE" && l.quantidadePendente > 0);
    if (!temSaldo) continue;

    const itens: ItemImportado[] = g.map((l) => {
      const pendente = Math.min(Math.max(0, l.quantidadePendente), l.quantidadePedida);
      return {
        referencia: l.referencia,
        quantidadePedida: l.quantidadePedida,
        // OK é tudo faturado; nos outros, faturou o que deixou de estar pendente.
        quantidadeFaturada: l.situacao === "OK" ? l.quantidadePedida : l.quantidadePedida - pendente,
        valorUnitario: l.valorUnitario,
        status: l.situacao,
      };
    });
    const datas = g.map((l) => l.dataPedido).filter((d): d is Date => d !== null);
    pedidos.push({
      chave,
      cnpj: g[0].cnpj,
      fantasia: g[0].fantasia,
      numero: g[0].numero,
      dataPedido: datas.length ? new Date(Math.min(...datas.map((d) => d.getTime()))) : null,
      // Já saiu nota para algum item: o pedido está parcial; senão, ainda sem nota.
      estado: itens.some((i) => i.quantidadeFaturada > 0) ? "PARCIAL" : "SEM_NFE",
      itens,
      saldo: centavos(
        itens
          .filter((i) => i.status === "PENDENTE")
          .reduce((s, i) => s + (i.quantidadePedida - i.quantidadeFaturada) * i.valorUnitario, 0),
      ),
    });
  }
  return pedidos.sort((a, b) => (a.dataPedido?.getTime() ?? 0) - (b.dataPedido?.getTime() ?? 0));
}

const CABECALHOS = {
  cnpj: ["CNPJ"],
  fantasia: ["FANTASIA", "NOME FANTASIA"],
  dataPedido: ["MES/ANO PEDIDO"],
  numero: ["N PEDIDO", "NO PEDIDO", "Nº PEDIDO"],
  referencia: ["REF", "REFERENCIA"],
  quantidadePedida: ["QNT PEDIDO", "QTD PEDIDO"],
  quantidadePendente: ["QNT PENDENTE", "QTD PENDENTE"],
  valorUnitario: ["VR UNT PENDENTE", "VR UNIT PENDENTE", "VALOR UNITARIO"],
  situacao: ["SITUACAO"],
} as const;

type Coluna = keyof typeof CABECALHOS;

/** Acha a linha de cabeçalho e o índice de cada coluna (0-based) numa grade de valores. */
export function localizarCabecalho(grade: unknown[][]): { linha: number; colunas: Record<Coluna, number> } | null {
  const alvo = (t: string) => normalizarTexto(t).replace(/º/g, "").replace(/[^\w/ ]/g, "").replace(/\s+/g, " ").trim();
  for (let i = 0; i < Math.min(grade.length, 15); i++) {
    const textos = grade[i].map((c) => alvo(String(c ?? "")));
    const colunas: Partial<Record<Coluna, number>> = {};
    for (const campo of Object.keys(CABECALHOS) as Coluna[]) {
      const idx = textos.findIndex((t) => CABECALHOS[campo].some((nome) => alvo(nome) === t));
      if (idx >= 0) colunas[campo] = idx;
    }
    if (Object.keys(colunas).length === Object.keys(CABECALHOS).length) return { linha: i, colunas: colunas as Record<Coluna, number> };
  }
  return null;
}

const numero = (v: unknown) => {
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

/** Lê a grade da aba de pedidos. Linhas sem CNPJ, sem referência ou com situação desconhecida ficam de fora e são contadas. */
export function lerLinhasAcompanhamento(grade: unknown[][]): { linhas: LinhaAcompanhamento[]; ignoradas: number } {
  const cab = localizarCabecalho(grade);
  if (!cab) throw new Error("Não achei o cabeçalho (CNPJ, FANTASIA, MÊS/ANO PEDIDO, Nº PEDIDO, REF, QNT…, SITUAÇÃO).");
  const c = cab.colunas;
  const linhas: LinhaAcompanhamento[] = [];
  let ignoradas = 0;
  for (const row of grade.slice(cab.linha + 1)) {
    const cnpj = lerCnpj(row[c.cnpj]);
    const referencia = String(row[c.referencia] ?? "").trim();
    const situacao = lerSituacao(String(row[c.situacao] ?? ""));
    if (!cnpj || !referencia || !situacao) {
      if (row.some((v) => v !== null && v !== undefined && v !== "")) ignoradas++;
      continue;
    }
    const data = row[c.dataPedido];
    linhas.push({
      cnpj,
      fantasia: String(row[c.fantasia] ?? "").trim() || cnpj,
      dataPedido: data instanceof Date && !Number.isNaN(data.getTime()) ? data : null,
      numero: lerNumeroPedido(row[c.numero]),
      referencia,
      quantidadePedida: Math.round(numero(row[c.quantidadePedida])),
      quantidadePendente: Math.round(numero(row[c.quantidadePendente])),
      valorUnitario: numero(row[c.valorUnitario]),
      situacao,
    });
  }
  return { linhas, ignoradas };
}
