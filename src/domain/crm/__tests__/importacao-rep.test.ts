import { describe, it, expect } from "vitest";
import {
  lerCsv,
  mapearConta,
  mapearContato,
  mapearInteracao,
  mapearPedidoHistorico,
  nomeFabrica,
} from "../importacao-rep";

describe("lerCsv", () => {
  it("lê cabeçalho, campos entre aspas com vírgula, aspas escapadas e quebra de linha", () => {
    const texto = '﻿a,b,c\n1,"x, y","diz ""oi"""\n2,"linha\nnova",\n';
    expect(lerCsv(texto)).toEqual([
      { a: "1", b: "x, y", c: 'diz "oi"' },
      { a: "2", b: "linha\nnova", c: "" },
    ]);
  });

  it("aceita CRLF e ignora linhas vazias", () => {
    expect(lerCsv("a,b\r\n1,2\r\n\r\n")).toEqual([{ a: "1", b: "2" }]);
  });
});

const contaBase = {
  conta_id: "CLI-001",
  nome: "ARAUTHO",
  tipo: "cliente",
  situacao: "cliente",
  uf: "TO",
  cidade: "",
  cnpj: "",
  site: "",
  rotulos_planilha: "ARAUTHO - TO",
  grupo: "",
  dono: "Rômulo",
  proxima_acao: "",
  prazo: "",
  observacoes: "",
  atualizado_em: "2026-10-03",
};

describe("mapearConta", () => {
  it("mapeia cliente sem CNPJ para CNPJ nulo e campos vazios para nulo", () => {
    expect(mapearConta(contaBase)).toEqual({
      chave: "CLI-001",
      nomeFantasia: "ARAUTHO",
      cnpj: null,
      situacao: "CLIENTE",
      cidade: null,
      uf: "TO",
      site: null,
      grupo: null,
      observacoes: null,
      proximoPasso: null,
    });
  });

  it("normaliza CNPJ com máscara e converte situação da prospecção", () => {
    const conta = mapearConta({ ...contaBase, conta_id: "RUD-001", situacao: "em_contato", cnpj: "02.075.227/0001-21" });
    expect(conta.cnpj).toBe("02075227000121");
    expect(conta.situacao).toBe("EM_CONTATO");
  });

  it("cria próximo passo só quando há ação e prazo", () => {
    const comPrazo = mapearConta({ ...contaBase, proxima_acao: "Ligar para Compras", prazo: "2026-10-10" });
    expect(comPrazo.proximoPasso).toEqual({
      acao: "Ligar para Compras",
      prazo: new Date("2026-10-10T00:00:00.000Z"),
      dono: "Rômulo",
    });
    expect(mapearConta({ ...contaBase, proxima_acao: "Avaliar a empresa" }).proximoPasso).toBeNull();
  });

  it("recusa situação desconhecida em vez de adivinhar", () => {
    expect(() => mapearConta({ ...contaBase, situacao: "quente" })).toThrow(/CLI-001.*quente/);
  });
});

const contatoBase = {
  conta_id: "RUD-001",
  nome: "",
  funcao: "",
  canal: "email",
  valor: "compras@exemplo.com.br",
  serve_para: "Compras",
  status: "publicado no site, não testado",
  fonte: "https://exemplo.com.br/contato",
  verificado_em: "2026-10-03",
  nao_contatar: "",
  observacoes: "",
};

describe("mapearContato", () => {
  it("mapeia canal, data de verificação e campos vazios", () => {
    expect(mapearContato(contatoBase)).toEqual({
      chaveConta: "RUD-001",
      nome: null,
      funcao: null,
      canal: "EMAIL",
      valor: "compras@exemplo.com.br",
      servePara: "Compras",
      status: "publicado no site, não testado",
      fonte: "https://exemplo.com.br/contato",
      verificadoEm: new Date("2026-10-03T00:00:00.000Z"),
      naoContatar: false,
      observacoes: null,
    });
  });

  it("entende não contatar marcado", () => {
    expect(mapearContato({ ...contatoBase, nao_contatar: "sim" }).naoContatar).toBe(true);
  });

  it("recusa contato sem fonte", () => {
    expect(() => mapearContato({ ...contatoBase, fonte: " " })).toThrow(/fonte/);
  });
});

describe("mapearInteracao", () => {
  it("mapeia data, canal e textos", () => {
    expect(
      mapearInteracao({
        data: "2026-10-03",
        conta_id: "RUD-001",
        canal: "pesquisa",
        com_quem: "",
        resumo: "Pesquisa pública em site e catálogo.",
        resultado: "",
        registrado_em: "2026-10-03 13:00",
      }),
    ).toEqual({
      chaveConta: "RUD-001",
      data: new Date("2026-10-03T00:00:00.000Z"),
      canal: "PESQUISA",
      comQuem: null,
      resumo: "Pesquisa pública em site e catálogo.",
      resultado: null,
    });
  });
});

const pedidoBase = {
  linha_planilha: "3",
  data: "2026-01-15",
  fabricante: "AUTOFLEX",
  cliente_planilha: "ARAUTHO - TO",
  conta_id: "CLI-001",
  valor_sem_imposto: "11955.36",
  tipo: "pedido",
  alerta: "",
};

describe("mapearPedidoHistorico", () => {
  it("mapeia linha comum", () => {
    expect(mapearPedidoHistorico(pedidoBase)).toEqual({
      chaveConta: "CLI-001",
      linhaPlanilha: 3,
      data: new Date("2026-01-15T00:00:00.000Z"),
      dataSoMes: false,
      fabricante: "AUTOFLEX",
      valor: "11955.36",
      tipo: "PEDIDO",
      rotuloPlanilha: "ARAUTHO - TO",
      suspeitaDuplicidade: false,
      alerta: null,
    });
  });

  it("marca data que pode ser só o mês e linha que parece repetida", () => {
    const diaUm = mapearPedidoHistorico({ ...pedidoBase, alerta: "dia 1: a data pode ser só o mês" });
    expect(diaUm.dataSoMes).toBe(true);
    expect(diaUm.suspeitaDuplicidade).toBe(false);

    const repetido = mapearPedidoHistorico({ ...pedidoBase, alerta: "parece repetido (igual à linha 109 da planilha)" });
    expect(repetido.suspeitaDuplicidade).toBe(true);
    expect(repetido.alerta).toBe("parece repetido (igual à linha 109 da planilha)");
  });

  it("mapeia bonificação e recusa valor não numérico", () => {
    expect(mapearPedidoHistorico({ ...pedidoBase, tipo: "bonificacao" }).tipo).toBe("BONIFICACAO");
    expect(() => mapearPedidoHistorico({ ...pedidoBase, valor_sem_imposto: "abc" })).toThrow(/linha 3/);
  });
});

describe("nomeFabrica", () => {
  it("dá nome de exibição às fábricas da planilha", () => {
    expect(nomeFabrica("AUTOFLEX")).toBe("Autoflex");
    expect(nomeFabrica("SEINECA - H3 COMERCIO")).toBe("Seineca/H3");
    expect(nomeFabrica("RUDOLPH")).toBe("Rudolph");
  });
});
