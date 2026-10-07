import { normalizarCnpj } from "../cadastro/cnpj";
import { emCentavos, formatarReais } from "../formato/moeda";

/**
 * Normalização e conferência de um pedido lido de PDF.
 *
 * A extração em si (ler o PDF) acontece fora daqui, em `src/lib/extracao-pdf.ts`, porque
 * depende de rede. Este módulo é puro: recebe o que foi extraído como texto e decide o que
 * dá para confiar. Nenhuma extração de PDF acerta 100%, então o produto é o par
 * "valor normalizado + problema apontado" — quem corrige é o operador, na tela de revisão.
 *
 * A conferência aritmética é o que torna isso confiável sem depender da IA se autoavaliar:
 * o pedido de venda já imprime o número de itens, a soma das quantidades e o total de
 * produtos. Se as três fecham com o que foi lido, a leitura está certa. Se não fecham, o
 * sistema sabe dizer exatamente onde olhar.
 */

/** O que a extração devolve: texto cru, exatamente como está impresso no PDF. */
export type ItemBrutoPdf = {
  codigo: string;
  descricao: string;
  unidade: string;
  quantidade: string;
  valorUnitario: string;
  valorTotal: string;
};

export type ExtracaoBrutaPdf = {
  cabecalho: {
    numeroPedido: string;
    data: string;
    fabricaCnpj: string;
    clienteCnpj: string;
  };
  itens: ItemBrutoPdf[];
  totais: {
    numeroItens: string;
    somaQuantidades: string;
    totalProdutos: string;
  };
};

export type ItemRevisao = {
  referencia: string;
  descricao: string;
  unidade: string;
  quantidade: number | null;
  valorUnitario: number | null;
  problemas: string[];
};

export type ConferenciaExtracao = {
  itensLidos: number;
  itensDeclarados: number | null;
  contagemConfere: boolean;
  somaQuantidadesLida: number;
  somaQuantidadesDeclarada: number | null;
  somaQuantidadesConfere: boolean;
  totalCalculado: number;
  totalDeclarado: number | null;
  totalConfere: boolean;
  /** Verdadeiro só quando as três conferem e nenhuma linha tem problema. */
  confere: boolean;
};

export type ExtracaoNormalizada = {
  cabecalho: {
    numeroPedido: string;
    data: Date | null;
    fabricaCnpj: string;
    clienteCnpj: string;
  };
  itens: ItemRevisao[];
  conferencia: ConferenciaExtracao;
};

/** Centavo de folga por linha: o ERP arredonda o total impresso. */
const TOLERANCIA_LINHA_CENTAVOS = 1;

/**
 * `"1.234,56"` → `1234.56`. Vírgula é o separador decimal; ponto é milhar.
 *
 * Devolve `null` — nunca `NaN` — no que não é número. O parser de Excel usava `Number()`
 * cru, que devolvia `NaN` silencioso, passava pela validação (`NaN <= 0` é `false`) e só
 * estourava no Prisma, derrubando a importação inteira sem mensagem.
 */
export function numeroBr(texto: string): number | null {
  const limpo = texto.replace(/[^\d.,-]/g, "").trim();
  if (!limpo) return null;

  let normalizado: string;
  if (limpo.includes(",")) {
    normalizado = limpo.replace(/\./g, "").replace(",", ".");
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(limpo)) {
    // Só pontos, agrupando de três em três: é milhar, não decimal.
    normalizado = limpo.replace(/\./g, "");
  } else {
    normalizado = limpo;
  }

  const valor = Number(normalizado);
  return Number.isFinite(valor) ? valor : null;
}

/** `"28/07/2026"` → `Date`. Devolve `null` no que não é data válida do calendário. */
export function dataBr(texto: string): Date | null {
  const casamento = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto.trim());
  if (!casamento) return null;

  const [, dia, mes, ano] = casamento.map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia));

  // 31/02 vira 03/03 em JS; o round-trip pega isso.
  const valida =
    data.getUTCFullYear() === ano && data.getUTCMonth() === mes - 1 && data.getUTCDate() === dia;
  return valida ? data : null;
}

function normalizarItem(bruto: ItemBrutoPdf): ItemRevisao {
  const problemas: string[] = [];

  const referencia = bruto.codigo.trim();
  if (!referencia) {
    problemas.push("Código do produto não foi lido; sem ele a NFe não casa com este item.");
  }

  const quantidade = numeroBr(bruto.quantidade);
  if (quantidade === null) {
    problemas.push("Quantidade não foi lida. Preencha à mão.");
  } else if (quantidade <= 0) {
    problemas.push("Quantidade tem de ser maior que zero.");
  } else if (!Number.isInteger(quantidade)) {
    problemas.push(`Quantidade ${quantidade} não é inteira; o pedido guarda unidades inteiras.`);
  }

  const valorUnitario = numeroBr(bruto.valorUnitario);
  if (valorUnitario === null) {
    problemas.push("Valor unitário não foi lido. Preencha à mão.");
  } else if (valorUnitario < 0) {
    problemas.push("Valor unitário não pode ser negativo.");
  }

  // O total impresso na linha é a testemunha de que quantidade e valor foram lidos das
  // colunas certas: trocar duas colunas parecidas quebra esta conta.
  const totalImpresso = numeroBr(bruto.valorTotal);
  if (quantidade !== null && valorUnitario !== null && totalImpresso !== null) {
    const calculado = quantidade * valorUnitario;
    if (Math.abs(emCentavos(calculado) - emCentavos(totalImpresso)) > TOLERANCIA_LINHA_CENTAVOS) {
      problemas.push(
        `Total da linha não fecha: o PDF diz ${formatarReais(totalImpresso)}, mas ${quantidade} × ${formatarReais(valorUnitario)} dá ${formatarReais(calculado)}.`,
      );
    }
  }

  return {
    referencia,
    descricao: bruto.descricao.trim(),
    unidade: bruto.unidade.trim(),
    quantidade,
    valorUnitario,
    problemas,
  };
}

function conferir(itens: ItemRevisao[], totais: ExtracaoBrutaPdf["totais"]): ConferenciaExtracao {
  const itensDeclarados = numeroBr(totais.numeroItens);
  const somaQuantidadesDeclarada = numeroBr(totais.somaQuantidades);
  const totalDeclarado = numeroBr(totais.totalProdutos);

  const somaQuantidadesLida = itens.reduce((soma, item) => soma + (item.quantidade ?? 0), 0);
  const totalCalculado = itens.reduce(
    (soma, item) => soma + (item.quantidade ?? 0) * (item.valorUnitario ?? 0),
    0,
  );

  // A folga acompanha o número de linhas: cada total impresso já vem arredondado.
  const toleranciaTotal = Math.max(5, itens.length * TOLERANCIA_LINHA_CENTAVOS);

  const contagemConfere = itensDeclarados === null || itens.length === itensDeclarados;
  const somaQuantidadesConfere =
    somaQuantidadesDeclarada === null || somaQuantidadesLida === somaQuantidadesDeclarada;
  const totalConfere =
    totalDeclarado === null ||
    Math.abs(emCentavos(totalCalculado) - emCentavos(totalDeclarado)) <= toleranciaTotal;

  const semProblemas = itens.every((item) => item.problemas.length === 0);

  return {
    itensLidos: itens.length,
    itensDeclarados,
    contagemConfere,
    somaQuantidadesLida,
    somaQuantidadesDeclarada,
    somaQuantidadesConfere,
    totalCalculado,
    totalDeclarado,
    totalConfere,
    confere:
      contagemConfere && somaQuantidadesConfere && totalConfere && semProblemas && itens.length > 0,
  };
}

export function normalizarExtracao(bruta: ExtracaoBrutaPdf): ExtracaoNormalizada {
  const itens = bruta.itens.map(normalizarItem);

  return {
    cabecalho: {
      numeroPedido: bruta.cabecalho.numeroPedido.trim(),
      data: dataBr(bruta.cabecalho.data),
      fabricaCnpj: normalizarCnpj(bruta.cabecalho.fabricaCnpj),
      clienteCnpj: normalizarCnpj(bruta.cabecalho.clienteCnpj),
    },
    itens,
    conferencia: conferir(itens, bruta.totais),
  };
}
