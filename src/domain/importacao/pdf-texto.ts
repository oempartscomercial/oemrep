import type { ExtracaoBrutaPdf, ItemBrutoPdf } from "./pdf";

/**
 * Reconstrói um pedido a partir do TEXTO já extraído do PDF (a leitura da camada de texto
 * acontece fora daqui, em `src/lib`, porque depende de biblioteca). Função pura: recebe as
 * linhas como o pdfjs as entrega, agrupadas por linha e ordenadas da esquerda para a
 * direita, e devolve o mesmo formato cru que a extração por IA produziria — então o resto
 * do pipeline (normalizarExtracao, tela de revisão) não muda.
 *
 * Afinado para o layout do Bling (Bowden/Autoflex), onde cada item tem uma linha de dados
 * no formato `<código> <unidade> <qtd> <valor unit.> <valor total>`, geralmente com o
 * começo da descrição grudado à esquerda. Um layout de outra fábrica pede outra regra —
 * é o "mapeamento por cliente" que o roteiro sempre previu.
 */

// Um número no formato brasileiro: milhar com ponto, decimal com vírgula (8.222,76).
const NUM = String.raw`\d[\d.]*,\d+`;

// A linha de dados de um item: descrição opcional à esquerda (algumas linhas começam
// direto no código), depois o código (4+ dígitos, sempre precedido de início de linha ou
// espaço — o que descarta o "40150270" grudado em "BW-40150270"), a unidade e os três
// números brasileiros. Só casa quando os cinco campos se alinham, o que na seção de itens
// só acontece na linha de dados, nunca numa linha de descrição.
const LINHA_ITEM = new RegExp(
  String.raw`^(?:(.*?)\s)?(\d{4,})\s+(\S+)\s+(${NUM})\s+(${NUM})\s+(${NUM})\s*$`,
);

function primeiroCnpj(texto: string, ocorrencia: number): string {
  const achados = [...texto.matchAll(/CNPJ:\s*([\d.\/-]+)/g)];
  return achados[ocorrencia]?.[1]?.trim() ?? "";
}

function capturar(texto: string, regex: RegExp): string {
  return regex.exec(texto)?.[1]?.trim() ?? "";
}

export function interpretarTextoPdf(texto: string): ExtracaoBrutaPdf {
  const linhas = texto.split("\n");

  // A seção de itens vai de "Itens do pedido" até o rodapé de totais. Fora dela nada é item.
  const inicio = linhas.findIndex((l) => /Itens do pedido/i.test(l));
  const fim = linhas.findIndex((l) => /N[º°o]\s*de\s*itens/i.test(l));
  const secao = linhas.slice(inicio >= 0 ? inicio + 1 : 0, fim >= 0 ? fim : linhas.length);

  const bufferDescricao: string[] = [];
  const itens: ItemBrutoPdf[] = [];

  for (const linha of secao) {
    const m = LINHA_ITEM.exec(linha);
    if (!m) {
      // Linha de descrição solta (enrolou); guarda como reserva caso a linha de dados do
      // próximo item não traga descrição inline.
      const limpa = linha.trim();
      if (limpa) bufferDescricao.push(limpa);
      continue;
    }

    const [, descInline, codigo, unidade, quantidade, valorUnitario, valorTotal] = m;
    const descricao = (descInline ?? "").trim() || bufferDescricao.join(" ").trim();
    bufferDescricao.length = 0;

    itens.push({ codigo, descricao, unidade, quantidade, valorUnitario, valorTotal });
  }

  return {
    cabecalho: {
      numeroPedido: capturar(texto, /N[úu]mero do pedido\s+(\S+)/i),
      data: capturar(texto, /\bData\s+(\d{2}\/\d{2}\/\d{4})/),
      fabricaCnpj: primeiroCnpj(texto, 0),
      clienteCnpj: primeiroCnpj(texto, 1),
    },
    itens,
    totais: {
      numeroItens: capturar(texto, /N[º°o]\s*de\s*itens\s+(\S+)/i),
      somaQuantidades: capturar(texto, /Soma das Qtdes\s+(\S+)/i),
      totalProdutos: capturar(texto, /Total de produtos\s+(\S+)/i),
    },
  };
}
