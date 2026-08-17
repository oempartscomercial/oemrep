import { describe, it, expect } from "vitest";
import { interpretarTextoPdf } from "../pdf-texto";
import { normalizarExtracao } from "../pdf";

// Trecho real da leitura (pdfjs) do pedido 4103 da Bowden, com os casos que mais quebram
// um parser: descrição que enrola em várias linhas, o código repetido na própria linha de
// dados, e o código escrito com espaços no meio da descrição ("40 150 762").
const TEXTO = `BOWDEN AUTOMOTIVA LTDA - (11) 2011-3223
CNPJ: 42.642.806/0001-23, IE: 799.450.091.116
Pedido 4103
Cliente
Número do pedido 4103
ESPACIAL AUTO PECAS LTDA
CNPJ: 09.114.091/0001-60,
Data 28/07/2026
IE: 200248650
Data prevista
Itens do pedido de venda
Valor
Descrição do produto/serviço Código Un. Qtd. Valor total
unitário
CABO DE SELEÇÃO E ENGATE (DO TRAMBULADOR)
CELTA - CLASSIC - PRISMA BW-40150270 - GM-93386267 - 40150270 CJ 40,0000 205,5690 8.222,76
98500555
ALAVANCA SELETORA DO TRAMBULADOR 40150680 40150680 CJ 10,0000 23,0220 230,22
CONJ. MANOPLA (POMO) E DISPLAY DE MARCHAS 40 150
762 - 90 522 811 Astra - Zafira - Vectra - Celta e Corsa 40150762 CJ 5,0000 26,9820 134,91
Classic
N° de itens 3,00
Soma das Qtdes 55,00
Total de produtos 8.588,09
Total do pedido 8.588,09`;

describe("interpretarTextoPdf — cabeçalho", () => {
  it("lê o número do pedido", () => {
    expect(interpretarTextoPdf(TEXTO).cabecalho.numeroPedido).toBe("4103");
  });

  it("lê a data do pedido, sem confundir com 'Data prevista'", () => {
    expect(interpretarTextoPdf(TEXTO).cabecalho.data).toBe("28/07/2026");
  });

  it("usa o primeiro CNPJ como fábrica e o segundo como cliente", () => {
    const { cabecalho } = interpretarTextoPdf(TEXTO);
    expect(cabecalho.fabricaCnpj).toBe("42.642.806/0001-23");
    expect(cabecalho.clienteCnpj).toBe("09.114.091/0001-60");
  });
});

describe("interpretarTextoPdf — itens", () => {
  it("lê exatamente as três linhas de dados, ignorando descrição e cabeçalho", () => {
    expect(interpretarTextoPdf(TEXTO).itens).toHaveLength(3);
  });

  it("extrai código, unidade, quantidade e valores da linha de dados", () => {
    const [primeiro] = interpretarTextoPdf(TEXTO).itens;
    expect(primeiro.codigo).toBe("40150270");
    expect(primeiro.unidade).toBe("CJ");
    expect(primeiro.quantidade).toBe("40,0000");
    expect(primeiro.valorUnitario).toBe("205,5690");
    expect(primeiro.valorTotal).toBe("8.222,76");
  });

  it("não confunde o código repetido na linha (40150680 40150680)", () => {
    const item = interpretarTextoPdf(TEXTO).itens[1];
    expect(item.codigo).toBe("40150680");
    expect(item.quantidade).toBe("10,0000");
    expect(item.valorTotal).toBe("230,22");
  });

  it("não confunde o código quebrado por espaços na descrição (40 150 762)", () => {
    const item = interpretarTextoPdf(TEXTO).itens[2];
    expect(item.codigo).toBe("40150762");
    expect(item.valorUnitario).toBe("26,9820");
  });

  it("usa o texto antes do código como descrição do item", () => {
    const [primeiro] = interpretarTextoPdf(TEXTO).itens;
    expect(primeiro.descricao).toContain("CELTA");
    expect(primeiro.descricao).not.toContain("40150270 CJ");
  });
});

describe("interpretarTextoPdf — totais", () => {
  it("lê nº de itens, soma das quantidades e total de produtos", () => {
    const { totais } = interpretarTextoPdf(TEXTO);
    expect(totais.numeroItens).toBe("3,00");
    expect(totais.somaQuantidades).toBe("55,00");
    expect(totais.totalProdutos).toBe("8.588,09");
  });
});

// Texto real e completo do pedido 4103, exatamente como o pdfjs entrega (86 linhas, duas
// páginas). É a prova de que a leitura por texto + a normalização validam o documento
// inteiro sem a IA.
const TEXTO_4103_COMPLETO = `BOWDEN AUTOMOTIVA LTDA - (11) 2011-3223
Rua Dr. Vital Brasil, N° 200
09666080 - São Bernardo do Campo, SP
CNPJ: 42.642.806/0001-23, IE: 799.450.091.116
Pedido 4103
Cliente
Número do pedido 4103
ESPACIAL AUTO PECAS LTDA
CNPJ: 09.114.091/0001-60,
Data 28/07/2026
IE: 200248650
AV NASCIMENTO DE CASTRO, N° 1884, Bairro: LAGOA NOVA
Data prevista
Natal, RN, 59056450, admpecas@espacialautopecas.com.br
Vendedor
Romulo - Ceará; Pauí e Rio Grande do Norte
Itens do pedido de venda
Valor
Descrição do produto/serviço Código Un. Qtd. Valor total
unitário
CABO DE SELEÇÃO E ENGATE (DO TRAMBULADOR)
CELTA - CLASSIC - PRISMA BW-40150270 - GM-93386267 - 40150270 CJ 40,0000 205,5690 8.222,76
98500555
CABO DE MARCHAS ONIX 2015 a 2019 PRISMA 2013 A
2019 COBALT 2012 A 2017 SPIN 2012 A 2019 GM25186044 40150915 PÇ 10,0000 225,0270 2.250,27
- BW 40150915
Cabo De Engate E Seleção 5 e 6 Marchas ONIX HATCH E
SEDAN TURBO ASPIRADO - 2019 em diante - 40150856 CJ 24,0000 281,6910 6.760,58
GM24591690 - BW 40150856
CABO DE ENGATE E SELEÇÃO DE MARCHAS 40150686 -
40150686 PÇ 2,0000 280,6200 561,24
24585032 CELTA/CLASSIC - A PARTIR DE NOV / 2014
CONJ. MANCAL SUPERIOR (GORDINHO) (MANCAL DO
40150079 CJ 10,0000 31,1220 311,22
TRAMBULADOR) BW-40150079 GM-98500170
ALAVANCA SELETORA DO TRAMBULADOR 40150680 40150680 CJ 10,0000 23,0220 230,22
CONJ. EIXO COM PINO E BUCHA BW - 40150766 40150766 CJ 10,0000 39,4560 394,56
BUCHA PRETA E BRANCA (TERMINAIS DE CABO) + PINO
40150807 CJ 30,0000 10,4490 313,47
DE ARTICULAÇÃO BW-40150807 - VIDE INFO. ADIC.
CONJ. BUCHA ESFÉRICA E ANEL BW-40150276 GM-
40150276 CJ 5,0000 6,3180 31,59
93347154
CONJ. ALAVANCA DE SELEÇÃO E EIXO 40150377 -
40150377 CJ 2,0000 18,7380 37,48
24578488 AGILE - MONTANA
CONJ. DA TRANSMISSÃO AGILE (JOY) 2009 / 14 -
40150388 PÇ 1,0000 325,5480 325,55
40150388 - 24578497
CONJ. ESPECIAL PINO TRAVA E BUCHA
40150684 CJ 10,0000 8,0910 80,91
ASTRA/ZAFIRA/VECTRA/CELTA/PRISMA/CORSA
CONJ. PINO ESFÉRICO - PORCA - ARRUELAS 40150754 -
93329550 AGILE-ASTRA-ZAFIRA-VECTRA-CELTA-PRISMA- 40150754 PÇ 2,0000 23,3730 46,75
CORSA SEDAN-CLASSIC
CONJ. ALAVANCA DE MUDANÇA 40150351 - 94718028
40150351 PÇ 1,0000 142,6230 142,62
CELTA MAJOR 2007 EM DIANTE
CONJ. ALAVANCA DE ENGATE COM COBERTURA DO EIXO
40150763 - 24579439 (EIXO DO TRAMBULADOR COM 40150763 PÇ 6,0000 90,5760 543,46
PARAFUSO
REPARO PARA TRAMBULADORES COM QUICK ASTRA
40150891 CJ 5,0000 151,6320 758,16
ZAFIRA VECTRA CELTA PRISMA CORSA - BW 40150891
REPARO DAALAVANCA DE MARCHAS AGILE E MONTANA -
40150836 PÇ 4,0000 67,8420 271,37
BW 40150836
REPARO PARA O TRAMBULADOR SISTEMA VARÃO - NOVO
CORSA 2002/2012 - MONTANA 2004/2010 - MERIVA 40150865 kit 3,0000 153,8370 461,51
2002/2012 - BW 40150865
CONJ. MANOPLA (POMO) E DISPLAY DE MARCHAS 40 150
762 - 90 522 811 Astra - Zafira - Vectra - Celta e Corsa 40150762 CJ 5,0000 26,9820 134,91
Classic
MANOPLA E DISPLAY PARA CORSA E PRISMA 2009 /
40150809 CJ 5,0000 25,4880 127,44
CLASSIC 2011 - BW 40150809
N° de itens 20,00
Soma das Qtdes 185,00
Total de produtos 22.006,07
Total do pedido 22.006,07
Parcelas
Dias Data vencimento Forma de pagamento Valor Observação
30 27/08/2026 Boleto - Bling Conta 7.335,35
60 26/09/2026 Boleto - Bling Conta 7.335,36
90 26/10/2026 Boleto - Bling Conta 7.335,36
Observações`;

describe("pedido 4103 real — leitura por texto de ponta a ponta", () => {
  it("lê as 20 linhas e nenhuma linha das parcelas", () => {
    expect(interpretarTextoPdf(TEXTO_4103_COMPLETO).itens).toHaveLength(20);
  });

  it("passa na conferência aritmética do documento inteiro após normalizar", () => {
    const bruta = interpretarTextoPdf(TEXTO_4103_COMPLETO);
    const { conferencia, itens, cabecalho } = normalizarExtracao(bruta);

    expect(cabecalho.fabricaCnpj).toBe("42642806000123");
    expect(cabecalho.clienteCnpj).toBe("09114091000160");
    expect(cabecalho.numeroPedido).toBe("4103");
    expect(itens.flatMap((i) => i.problemas)).toEqual([]);
    expect(conferencia.somaQuantidadesLida).toBe(185);
    expect(conferencia.confere).toBe(true);
  });
});
