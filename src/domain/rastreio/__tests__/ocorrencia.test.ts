import { describe, it, expect } from "vitest";
import {
  statusDaOcorrencia,
  statusSugerido,
  ultimaOcorrencia,
  type Ocorrencia,
} from "../ocorrencia";

function oc(descricao: string, data: string | null = null, codigo: string | null = null): Ocorrencia {
  return { data: data ? new Date(data) : null, descricao, local: null, codigo };
}

describe("statusDaOcorrencia", () => {
  it("entrega vira RECEBIDA, sem importar caixa ou acento", () => {
    expect(statusDaOcorrencia({ descricao: "ENTREGA REALIZADA", codigo: null })).toBe("RECEBIDA");
    expect(statusDaOcorrencia({ descricao: "Mercadoria entregue ao destinatário", codigo: null })).toBe("RECEBIDA");
    expect(statusDaOcorrencia({ descricao: "entregue", codigo: null })).toBe("RECEBIDA");
  });

  it("agendamento vira AGENDADO", () => {
    expect(statusDaOcorrencia({ descricao: "ENTREGA AGENDADA", codigo: null })).toBe("AGENDADO");
    expect(statusDaOcorrencia({ descricao: "AGENDAMENTO CONFIRMADO", codigo: null })).toBe("AGENDADO");
  });

  it("trânsito, coleta, transferência, chegada, saída e emissão viram TRANSITO", () => {
    const textos = [
      "Em trânsito",
      "TRANSFERENCIA ENTRE FILIAIS",
      "CHEGADA EM UNIDADE DE TRANSBORDO",
      "SAIDA DE UNIDADE",
      "COLETA REALIZADA",
      "EM ROTA DE ENTREGA",
      "EMISSAO DO CT-E",
      "DOCUMENTO EMITIDO",
    ];
    for (const descricao of textos) {
      expect(statusDaOcorrencia({ descricao, codigo: null }), descricao).toBe("TRANSITO");
    }
  });

  it("texto observado na resposta real do SSW vira TRANSITO", () => {
    expect(statusDaOcorrencia({ descricao: "DOCUMENTO DE TRANSPORTE EMITIDO", codigo: "70" })).toBe("TRANSITO");
  });

  it("perda, sinistro, roubo e avaria total viram EXTRAVIADO", () => {
    expect(statusDaOcorrencia({ descricao: "EXTRAVIO DE MERCADORIA", codigo: null })).toBe("EXTRAVIADO");
    expect(statusDaOcorrencia({ descricao: "Sinistro registrado", codigo: null })).toBe("EXTRAVIADO");
    expect(statusDaOcorrencia({ descricao: "ROUBO DE CARGA", codigo: null })).toBe("EXTRAVIADO");
    expect(statusDaOcorrencia({ descricao: "AVARIA TOTAL", codigo: null })).toBe("EXTRAVIADO");
  });

  it("não é entrega quando vem negado", () => {
    expect(statusDaOcorrencia({ descricao: "MERCADORIA NAO ENTREGUE", codigo: null })).toBeNull();
    expect(statusDaOcorrencia({ descricao: "ENTREGA NAO REALIZADA", codigo: null })).toBeNull();
  });

  it("texto desconhecido vira null", () => {
    expect(statusDaOcorrencia({ descricao: "ALGUMA COISA NOVA DO SISTEMA", codigo: null })).toBeNull();
    expect(statusDaOcorrencia({ descricao: "", codigo: null })).toBeNull();
  });

  it("código SSW confirmado serve de reserva quando o texto não diz nada", () => {
    expect(statusDaOcorrencia({ descricao: "TEXTO QUALQUER", codigo: "72" })).toBe("TRANSITO");
    expect(statusDaOcorrencia({ descricao: "TEXTO QUALQUER", codigo: "999" })).toBeNull();
  });
});

describe("ultimaOcorrencia", () => {
  it("devolve a mais recente, mesmo fora de ordem na lista", () => {
    const lista = [
      oc("B", "2026-10-09T08:00:00-03:00"),
      oc("A", "2026-10-08T00:14:57-03:00"),
      oc("C", "2026-10-07T10:00:00-03:00"),
    ];
    expect(ultimaOcorrencia(lista)?.descricao).toBe("B");
  });

  it("ocorrência sem data não ganha de uma datada", () => {
    const lista = [oc("COM DATA", "2026-10-01T00:00:00Z"), oc("SEM DATA", null)];
    expect(ultimaOcorrencia(lista)?.descricao).toBe("COM DATA");
  });

  it("em empate de data, vale a última da lista", () => {
    const lista = [oc("PRIMEIRA", "2026-10-08T10:00:00Z"), oc("SEGUNDA", "2026-10-08T10:00:00Z")];
    expect(ultimaOcorrencia(lista)?.descricao).toBe("SEGUNDA");
  });

  it("sem nenhuma ocorrência devolve null", () => {
    expect(ultimaOcorrencia([])).toBeNull();
  });

  it("não altera a lista recebida", () => {
    const lista = [oc("B", "2026-10-09T00:00:00Z"), oc("A", "2026-10-08T00:00:00Z")];
    ultimaOcorrencia(lista);
    expect(lista.map((o) => o.descricao)).toEqual(["B", "A"]);
  });
});

describe("statusSugerido", () => {
  it("vale o status da ocorrência mais recente que mapeia para alguma coisa", () => {
    const lista = [
      oc("DOCUMENTO DE TRANSPORTE EMITIDO", "2026-10-08T00:14:57-03:00"),
      oc("CHEGADA EM UNIDADE DE TRANSBORDO", "2026-10-09T08:18:55-03:00"),
    ];
    expect(statusSugerido(lista)).toBe("TRANSITO");
  });

  it("AGENDADO mais recente vence um TRANSITO anterior", () => {
    const lista = [
      oc("EM TRANSITO", "2026-10-08T10:00:00-03:00"),
      oc("ENTREGA AGENDADA", "2026-10-09T10:00:00-03:00"),
    ];
    expect(statusSugerido(lista)).toBe("AGENDADO");
  });

  it("RECEBIDA vence um TRANSITO posterior (ruído)", () => {
    const lista = [
      oc("ENTREGA REALIZADA", "2026-10-08T15:00:00-03:00"),
      oc("CHEGADA EM UNIDADE", "2026-10-09T08:00:00-03:00"),
    ];
    expect(statusSugerido(lista)).toBe("RECEBIDA");
  });

  it("nunca sugere EXTRAVIADO: se o mais recente é perda, devolve null", () => {
    const lista = [
      oc("EM TRANSITO", "2026-10-08T10:00:00-03:00"),
      oc("EXTRAVIO REGISTRADO", "2026-10-09T10:00:00-03:00"),
    ];
    expect(statusSugerido(lista)).toBeNull();
  });

  it("perda sozinha também devolve null", () => {
    expect(statusSugerido([oc("ROUBO DE CARGA", "2026-10-09T10:00:00-03:00")])).toBeNull();
  });

  it("ocorrências desconhecidas depois de uma conhecida são ignoradas", () => {
    const lista = [
      oc("EM TRANSITO", "2026-10-08T10:00:00-03:00"),
      oc("OCORRENCIA SEM MAPA", "2026-10-09T10:00:00-03:00"),
    ];
    expect(statusSugerido(lista)).toBe("TRANSITO");
  });

  it("lista vazia ou só desconhecida devolve null", () => {
    expect(statusSugerido([])).toBeNull();
    expect(statusSugerido([oc("NADA A VER", null)])).toBeNull();
  });
});
