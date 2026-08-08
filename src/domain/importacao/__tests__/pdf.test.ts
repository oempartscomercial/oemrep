import { describe, it, expect } from "vitest";
import { numeroBr, dataBr, normalizarExtracao, type ExtracaoBrutaPdf } from "../pdf";

describe("numeroBr", () => {
  it("lê decimal brasileiro com vírgula", () => {
    expect(numeroBr("205,5690")).toBe(205.569);
    expect(numeroBr("40,0000")).toBe(40);
  });

  it("lê milhar com ponto e decimal com vírgula", () => {
    expect(numeroBr("22.006,07")).toBe(22006.07);
    expect(numeroBr("1.234,56")).toBe(1234.56);
  });

  it("lê inteiro sem separador", () => {
    expect(numeroBr("185")).toBe(185);
  });

  it("tolera espaço em volta e símbolo de moeda", () => {
    expect(numeroBr(" R$ 7.335,35 ")).toBe(7335.35);
  });

  it("devolve null no que não é número", () => {
    expect(numeroBr("")).toBeNull();
    expect(numeroBr("—")).toBeNull();
    expect(numeroBr("abc")).toBeNull();
  });

  // O parser do Excel usava Number() cru, que devolvia NaN silencioso e chegava ao banco.
  it("nunca devolve NaN", () => {
    for (const entrada of ["", "abc", "1,2,3", "-", "R$"]) {
      const resultado = numeroBr(entrada);
      expect(resultado === null || Number.isFinite(resultado)).toBe(true);
    }
  });
});

describe("dataBr", () => {
  it("lê dd/mm/aaaa", () => {
    expect(dataBr("28/07/2026")?.toISOString().slice(0, 10)).toBe("2026-07-28");
  });

  it("devolve null em data inválida ou vazia", () => {
    expect(dataBr("")).toBeNull();
    expect(dataBr("31/02/2026")).toBeNull();
    expect(dataBr("2026-07-28")).toBeNull();
  });
});

// Os valores abaixo são de um pedido real da Bowden (pedido 4103, 28/07/2026), reduzido
// a quatro linhas mais os totais verdadeiros do documento completo, para exercitar o
// caminho em que a conferência aritmética acusa item faltando.
const extracaoReal = (): ExtracaoBrutaPdf => ({
  cabecalho: {
    numeroPedido: "4103",
    data: "28/07/2026",
    fabricaCnpj: "42.642.806/0001-23",
    clienteCnpj: "09.114.091/0001-60",
  },
  itens: [
    { codigo: "40150270", descricao: "CABO DE SELEÇÃO E ENGATE (DO TRAMBULADOR)", unidade: "CJ", quantidade: "40,0000", valorUnitario: "205,5690", valorTotal: "8.222,76" },
    { codigo: "40150915", descricao: "CABO DE MARCHAS ONIX 2015 a 2019", unidade: "PÇ", quantidade: "10,0000", valorUnitario: "225,0270", valorTotal: "2.250,27" },
    { codigo: "40150856", descricao: "Cabo De Engate E Seleção 5 e 6 Marchas", unidade: "CJ", quantidade: "24,0000", valorUnitario: "281,6910", valorTotal: "6.760,58" },
    { codigo: "40150686", descricao: "CABO DE ENGATE E SELEÇÃO DE MARCHAS", unidade: "PÇ", quantidade: "2,0000", valorUnitario: "280,6200", valorTotal: "561,24" },
  ],
  totais: { numeroItens: "20,00", somaQuantidades: "185,00", totalProdutos: "22.006,07" },
});

describe("normalizarExtracao — cabeçalho", () => {
  it("normaliza o CNPJ da fábrica e do cliente para 14 dígitos", () => {
    const { cabecalho } = normalizarExtracao(extracaoReal());
    expect(cabecalho.fabricaCnpj).toBe("42642806000123");
    expect(cabecalho.clienteCnpj).toBe("09114091000160");
  });

  it("preserva o número do pedido e converte a data", () => {
    const { cabecalho } = normalizarExtracao(extracaoReal());
    expect(cabecalho.numeroPedido).toBe("4103");
    expect(cabecalho.data?.toISOString().slice(0, 10)).toBe("2026-07-28");
  });
});

describe("normalizarExtracao — itens", () => {
  it("preserva as quatro casas decimais do valor unitário", () => {
    const { itens } = normalizarExtracao(extracaoReal());
    expect(itens[0].valorUnitario).toBe(205.569);
  });

  it("usa o código do PDF como referência do item", () => {
    const { itens } = normalizarExtracao(extracaoReal());
    expect(itens[0].referencia).toBe("40150270");
  });

  it("não aponta problema em linha que fecha quantidade × valor = total", () => {
    const { itens } = normalizarExtracao(extracaoReal());
    expect(itens[0].problemas).toEqual([]);
  });

  it("aponta a linha cujo total não fecha com quantidade × valor unitário", () => {
    const bruta = extracaoReal();
    bruta.itens[1].valorTotal = "9.999,99";

    const { itens } = normalizarExtracao(bruta);

    expect(itens[1].problemas).toHaveLength(1);
    expect(itens[1].problemas[0]).toContain("R$ 2.250,27");
  });

  it("aponta quantidade ausente ou ilegível em vez de virar zero", () => {
    const bruta = extracaoReal();
    bruta.itens[2].quantidade = "";

    const { itens } = normalizarExtracao(bruta);

    expect(itens[2].quantidade).toBeNull();
    expect(itens[2].problemas.some((p) => p.includes("Quantidade"))).toBe(true);
  });

  it("aponta quantidade fracionada, que o pedido não sabe guardar", () => {
    const bruta = extracaoReal();
    bruta.itens[3].quantidade = "2,5000";

    const { itens } = normalizarExtracao(bruta);

    expect(itens[3].problemas.some((p) => p.includes("inteira"))).toBe(true);
  });

  it("aponta código ausente, que impede casar a NFe depois", () => {
    const bruta = extracaoReal();
    bruta.itens[0].codigo = "  ";

    const { itens } = normalizarExtracao(bruta);

    expect(itens[0].problemas.some((p) => p.includes("Código"))).toBe(true);
  });
});

describe("normalizarExtracao — conferência contra os totais do documento", () => {
  it("acusa quando o número de itens lidos difere do que o PDF declara", () => {
    const { conferencia } = normalizarExtracao(extracaoReal());

    expect(conferencia.contagemConfere).toBe(false);
    expect(conferencia.itensLidos).toBe(4);
    expect(conferencia.itensDeclarados).toBe(20);
  });

  it("acusa quando a soma das quantidades difere da declarada", () => {
    const { conferencia } = normalizarExtracao(extracaoReal());

    expect(conferencia.somaQuantidadesConfere).toBe(false);
    expect(conferencia.somaQuantidadesLida).toBe(76);
    expect(conferencia.somaQuantidadesDeclarada).toBe(185);
  });

  it("acusa quando o total de produtos difere do declarado", () => {
    const { conferencia } = normalizarExtracao(extracaoReal());

    expect(conferencia.totalConfere).toBe(false);
    expect(conferencia.totalDeclarado).toBe(22006.07);
  });

  it("confirma tudo quando as quatro linhas são o pedido inteiro", () => {
    const bruta = extracaoReal();
    bruta.totais = { numeroItens: "4", somaQuantidades: "76", totalProdutos: "17.794,85" };

    const { conferencia } = normalizarExtracao(bruta);

    expect(conferencia.contagemConfere).toBe(true);
    expect(conferencia.somaQuantidadesConfere).toBe(true);
    expect(conferencia.totalConfere).toBe(true);
    expect(conferencia.confere).toBe(true);
  });

  it("tolera diferença de centavos no total, que é arredondamento do próprio ERP", () => {
    const bruta = extracaoReal();
    bruta.totais = { numeroItens: "4", somaQuantidades: "76", totalProdutos: "17.794,87" };

    const { conferencia } = normalizarExtracao(bruta);

    expect(conferencia.totalConfere).toBe(true);
  });

  it("não considera conferido quando alguma linha tem problema", () => {
    const bruta = extracaoReal();
    bruta.totais = { numeroItens: "4", somaQuantidades: "76", totalProdutos: "17.794,85" };
    bruta.itens[0].codigo = "";

    const { conferencia } = normalizarExtracao(bruta);

    expect(conferencia.confere).toBe(false);
  });
});

// Pedido 4103 da Bowden para a Espacial Auto Peças, 28/07/2026, transcrito por inteiro do
// PDF: 20 linhas em duas páginas, com os totais que o próprio documento imprime. É a prova
// de que a conferência aritmética valida um pedido real de ponta a ponta.
const PEDIDO_4103: ExtracaoBrutaPdf = {
  cabecalho: {
    numeroPedido: "4103",
    data: "28/07/2026",
    fabricaCnpj: "42.642.806/0001-23",
    clienteCnpj: "09.114.091/0001-60",
  },
  itens: [
    { codigo: "40150270", descricao: "CABO DE SELEÇÃO E ENGATE (DO TRAMBULADOR) CELTA/CLASSIC/PRISMA", unidade: "CJ", quantidade: "40,0000", valorUnitario: "205,5690", valorTotal: "8.222,76" },
    { codigo: "40150915", descricao: "CABO DE MARCHAS ONIX 2015 a 2019 PRISMA 2013 A 2019 COBALT", unidade: "PÇ", quantidade: "10,0000", valorUnitario: "225,0270", valorTotal: "2.250,27" },
    { codigo: "40150856", descricao: "Cabo De Engate E Seleção 5 e 6 Marchas ONIX HATCH E SEDAN", unidade: "CJ", quantidade: "24,0000", valorUnitario: "281,6910", valorTotal: "6.760,58" },
    { codigo: "40150686", descricao: "CABO DE ENGATE E SELEÇÃO DE MARCHAS CELTA/CLASSIC", unidade: "PÇ", quantidade: "2,0000", valorUnitario: "280,6200", valorTotal: "561,24" },
    { codigo: "40150079", descricao: "CONJ. MANCAL SUPERIOR (GORDINHO)", unidade: "CJ", quantidade: "10,0000", valorUnitario: "31,1220", valorTotal: "311,22" },
    { codigo: "40150680", descricao: "ALAVANCA SELETORA DO TRAMBULADOR", unidade: "CJ", quantidade: "10,0000", valorUnitario: "23,0220", valorTotal: "230,22" },
    { codigo: "40150766", descricao: "CONJ. EIXO COM PINO E BUCHA", unidade: "CJ", quantidade: "10,0000", valorUnitario: "39,4560", valorTotal: "394,56" },
    { codigo: "40150807", descricao: "BUCHA PRETA E BRANCA (TERMINAIS DE CABO) + PINO", unidade: "CJ", quantidade: "30,0000", valorUnitario: "10,4490", valorTotal: "313,47" },
    { codigo: "40150276", descricao: "CONJ. BUCHA ESFÉRICA E ANEL", unidade: "CJ", quantidade: "5,0000", valorUnitario: "6,3180", valorTotal: "31,59" },
    { codigo: "40150377", descricao: "CONJ. ALAVANCA DE SELEÇÃO E EIXO AGILE/MONTANA", unidade: "CJ", quantidade: "2,0000", valorUnitario: "18,7380", valorTotal: "37,48" },
    { codigo: "40150388", descricao: "CONJ. DA TRANSMISSÃO AGILE (JOY) 2009/14", unidade: "PÇ", quantidade: "1,0000", valorUnitario: "325,5480", valorTotal: "325,55" },
    { codigo: "40150684", descricao: "CONJ. ESPECIAL PINO TRAVA E BUCHA", unidade: "CJ", quantidade: "10,0000", valorUnitario: "8,0910", valorTotal: "80,91" },
    { codigo: "40150754", descricao: "CONJ. PINO ESFÉRICO - PORCA - ARRUELAS", unidade: "PÇ", quantidade: "2,0000", valorUnitario: "23,3730", valorTotal: "46,75" },
    { codigo: "40150351", descricao: "CONJ. ALAVANCA DE MUDANÇA CELTA MAJOR 2007 EM DIANTE", unidade: "PÇ", quantidade: "1,0000", valorUnitario: "142,6230", valorTotal: "142,62" },
    { codigo: "40150763", descricao: "CONJ. ALAVANCA DE ENGATE COM COBERTURA DO EIXO", unidade: "PÇ", quantidade: "6,0000", valorUnitario: "90,5760", valorTotal: "543,46" },
    { codigo: "40150891", descricao: "REPARO PARA TRAMBULADORES COM QUICK", unidade: "CJ", quantidade: "5,0000", valorUnitario: "151,6320", valorTotal: "758,16" },
    { codigo: "40150836", descricao: "REPARO DA ALAVANCA DE MARCHAS AGILE E MONTANA", unidade: "PÇ", quantidade: "4,0000", valorUnitario: "67,8420", valorTotal: "271,37" },
    { codigo: "40150865", descricao: "REPARO PARA O TRAMBULADOR SISTEMA VARÃO", unidade: "kit", quantidade: "3,0000", valorUnitario: "153,8370", valorTotal: "461,51" },
    { codigo: "40150762", descricao: "CONJ. MANOPLA (POMO) E DISPLAY DE MARCHAS", unidade: "CJ", quantidade: "5,0000", valorUnitario: "26,9820", valorTotal: "134,91" },
    { codigo: "40150809", descricao: "MANOPLA E DISPLAY PARA CORSA E PRISMA 2009", unidade: "CJ", quantidade: "5,0000", valorUnitario: "25,4880", valorTotal: "127,44" },
  ],
  totais: { numeroItens: "20,00", somaQuantidades: "185,00", totalProdutos: "22.006,07" },
};

describe("pedido 4103 da Bowden — documento real completo", () => {
  it("passa na conferência aritmética inteira", () => {
    const { conferencia } = normalizarExtracao(PEDIDO_4103);

    expect(conferencia.itensLidos).toBe(20);
    expect(conferencia.contagemConfere).toBe(true);
    expect(conferencia.somaQuantidadesLida).toBe(185);
    expect(conferencia.somaQuantidadesConfere).toBe(true);
    expect(conferencia.totalConfere).toBe(true);
    expect(conferencia.confere).toBe(true);
  });

  it("não aponta problema em nenhuma das 20 linhas", () => {
    const { itens } = normalizarExtracao(PEDIDO_4103);

    expect(itens.flatMap((i) => i.problemas)).toEqual([]);
  });

  it("identifica fábrica e cliente por CNPJ de 14 dígitos", () => {
    const { cabecalho } = normalizarExtracao(PEDIDO_4103);

    expect(cabecalho.fabricaCnpj).toBe("42642806000123");
    expect(cabecalho.clienteCnpj).toBe("09114091000160");
    expect(cabecalho.numeroPedido).toBe("4103");
  });

  // Este é o caso que motivou alargar valorUnitario para Decimal(12,4): a 4ª casa é
  // dinheiro de verdade. Truncando em duas casas, a primeira linha erra R$ 0,04.
  it("preserva a quarta casa do valor unitário, que vale dinheiro", () => {
    const { itens } = normalizarExtracao(PEDIDO_4103);

    expect(itens[0].valorUnitario).toBe(205.569);
    expect((itens[0].quantidade ?? 0) * (itens[0].valorUnitario ?? 0)).toBeCloseTo(8222.76, 2);

    const truncadoEmCentavos = 40 * 205.57;
    expect(truncadoEmCentavos).toBeCloseTo(8222.8, 2);
  });

  it("detecta uma linha trocada de coluna pela conta que deixa de fechar", () => {
    const adulterado: ExtracaoBrutaPdf = {
      ...PEDIDO_4103,
      itens: PEDIDO_4103.itens.map((item, i) =>
        i === 0 ? { ...item, quantidade: item.valorUnitario, valorUnitario: item.quantidade } : item,
      ),
    };

    const { itens, conferencia } = normalizarExtracao(adulterado);

    expect(itens[0].problemas.length).toBeGreaterThan(0);
    expect(conferencia.confere).toBe(false);
  });
});
