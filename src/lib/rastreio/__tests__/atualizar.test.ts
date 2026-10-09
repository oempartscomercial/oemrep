import { describe, it, expect, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import type { Ocorrencia } from "@/domain/rastreio/ocorrencia";
import type { ResultadoConsulta } from "../ssw";
import { atualizarRastreioDaNota, atualizarRastreiosEmAberto, type Consultar } from "../atualizar";

const CNPJ_EMITENTE = "74100004000188";
const CNPJ_DESTINATARIO = "74100005000122";
const CNPJ_NAO_MAPEADA = "74100006000177";
const CNPJ_SSW = "74100007000111";
const CNPJ_MANUAL = "74100008000166";
const CNPJ_LOTE = "74100009000100";

// Chave de 44 dígitos; o número da nota muda a chave, então cada nota do teste tem a sua.
const chaveDe = (n: number) => "42" + CNPJ_EMITENTE + "55001" + String(n).padStart(9, "0") + "12345678901234";

const ocorrencia = (descricao: string, data: string, codigo: string | null = null, local: string | null = null): Ocorrencia => ({
  data: new Date(data),
  descricao,
  local,
  codigo,
});

const resposta = (ocorrencias: Ocorrencia[], previsaoEntrega: Date | null = null): ResultadoConsulta => ({
  ok: true,
  encontrado: true,
  ocorrencias,
  previsaoEntrega,
  transportadoraNome: null,
  bruto: null,
});
const naoAchou: ResultadoConsulta = { ok: true, encontrado: false, ocorrencias: [], previsaoEntrega: null, transportadoraNome: null, bruto: null };
const falhaDeRede: ResultadoConsulta = { ok: false, erro: "Tempo esgotado", tentarDeNovo: true };

async function criarTransportadora(cnpj: string, metodo: "NAO_MAPEADA" | "SSW" | "MANUAL", falhasSeguidas = 0) {
  return prisma.transportadora.create({ data: { cnpj, nome: `Transportadora ${metodo} teste`, metodo, falhasSeguidas } });
}

async function criarNota(n: number, status: "TRANSITO" | "AGENDADO" | "RECEBIDA", transportadoraId: string | null) {
  return prisma.notaFiscal.create({
    data: {
      numero: String(9400 + n),
      chaveAcesso: chaveDe(n),
      emitenteCnpj: CNPJ_EMITENTE,
      destinatarioCnpj: CNPJ_DESTINATARIO,
      dataEmissao: new Date("2026-10-01T12:00:00-03:00"),
      totalProdutos: 100,
      totalNota: 100,
      status,
      transportadoraId,
    },
  });
}

async function limpar() {
  await prisma.eventoRastreio.deleteMany({ where: { notaFiscal: { emitenteCnpj: CNPJ_EMITENTE } } });
  await prisma.notaFiscal.deleteMany({ where: { emitenteCnpj: CNPJ_EMITENTE } });
  await prisma.transportadora.deleteMany({
    where: { cnpj: { in: [CNPJ_NAO_MAPEADA, CNPJ_SSW, CNPJ_MANUAL, CNPJ_LOTE] } },
  });
}

describe("atualizarRastreioDaNota", () => {
  it("nota entregue: vira RECEBIDA, grava evento AUTOMATICO sem usuário, guarda ocorrência e previsão, e promove a transportadora a SSW", async () => {
    const t = await criarTransportadora(CNPJ_NAO_MAPEADA, "NAO_MAPEADA", 2);
    const nota = await criarNota(1, "TRANSITO", t.id);
    try {
      const previsao = new Date("2026-10-07T12:00:00-03:00");
      const consultar = vi.fn<Consultar>(async () =>
        resposta(
          [
            ocorrencia("SAIDA DE UNIDADE", "2026-10-05T08:00:00-03:00", "72", "SAO PAULO / SP"),
            ocorrencia("ENTREGA REALIZADA", "2026-10-06T16:30:00-03:00", null, "SAO LUIS / MA"),
          ],
          previsao,
        ),
      );

      const r = await atualizarRastreioDaNota(nota.id, consultar);

      expect(r).toEqual({ nota: "9401", situacao: "atualizada", status: "RECEBIDA", mudouStatus: true, ocorrencia: "ENTREGA REALIZADA" });
      expect(consultar).toHaveBeenCalledWith(nota.chaveAcesso);

      const atual = await prisma.notaFiscal.findUniqueOrThrow({ where: { id: nota.id } });
      expect(atual).toMatchObject({ status: "RECEBIDA", ultimaOcorrencia: "ENTREGA REALIZADA", rastreioFalhas: 0 });
      expect(atual.ultimaOcorrenciaEm?.toISOString()).toBe("2026-10-06T19:30:00.000Z");
      expect(atual.previsaoEntrega?.toISOString()).toBe(previsao.toISOString());

      const eventos = await prisma.eventoRastreio.findMany({ where: { notaFiscalId: nota.id } });
      expect(eventos).toHaveLength(1);
      expect(eventos[0]).toMatchObject({
        origem: "AUTOMATICO",
        usuarioId: null,
        statusAnterior: "TRANSITO",
        status: "RECEBIDA",
        observacao: "ENTREGA REALIZADA",
        local: "SAO LUIS / MA",
      });

      const depois = await prisma.transportadora.findUniqueOrThrow({ where: { id: t.id } });
      expect(depois).toMatchObject({ metodo: "SSW", falhasSeguidas: 0 });
      expect(depois.ultimaConsultaOk).not.toBeNull();
    } finally {
      await limpar();
    }
  }, 15000);

  it("só ocorrências de trânsito numa nota em TRANSITO: sem evento e status igual, mas guarda a última ocorrência", async () => {
    const t = await criarTransportadora(CNPJ_SSW, "SSW");
    const nota = await criarNota(2, "TRANSITO", t.id);
    try {
      const consultar = vi.fn<Consultar>(async () =>
        resposta([
          ocorrencia("DOCUMENTO DE TRANSPORTE EMITIDO (70)", "2026-10-03T09:00:00-03:00", "70"),
          ocorrencia("SAIDA DE UNIDADE", "2026-10-05T08:00:00-03:00", "72"),
        ]),
      );

      const r = await atualizarRastreioDaNota(nota.id, consultar);

      expect(r).toEqual({ nota: "9402", situacao: "atualizada", status: "TRANSITO", mudouStatus: false, ocorrencia: "SAIDA DE UNIDADE" });
      const atual = await prisma.notaFiscal.findUniqueOrThrow({ where: { id: nota.id } });
      expect(atual.status).toBe("TRANSITO");
      expect(atual.ultimaOcorrencia).toBe("SAIDA DE UNIDADE");
      expect(await prisma.eventoRastreio.count({ where: { notaFiscalId: nota.id } })).toBe(0);
    } finally {
      await limpar();
    }
  }, 15000);

  it("não encontrada: soma falha na nota e na transportadora, e depois de 3 para de consultar a nota", async () => {
    const t = await criarTransportadora(CNPJ_NAO_MAPEADA, "NAO_MAPEADA");
    const nota = await criarNota(3, "TRANSITO", t.id);
    try {
      const consultar = vi.fn<Consultar>(async () => naoAchou);

      for (let tentativa = 1; tentativa <= 3; tentativa++) {
        const r = await atualizarRastreioDaNota(nota.id, consultar);
        expect(r).toEqual({ nota: "9403", situacao: "nao-encontrada", motivo: "A transportadora não tem esta nota no SSW." });
      }
      expect(consultar).toHaveBeenCalledTimes(3);
      expect((await prisma.notaFiscal.findUniqueOrThrow({ where: { id: nota.id } })).rastreioFalhas).toBe(3);
      expect(await prisma.transportadora.findUniqueOrThrow({ where: { id: t.id } })).toMatchObject({ falhasSeguidas: 3, metodo: "NAO_MAPEADA" });

      const quarta = await atualizarRastreioDaNota(nota.id, consultar);
      expect(quarta).toEqual({ nota: "9403", situacao: "ignorada", motivo: "Transportadora ainda não mapeada." });
      expect(consultar).toHaveBeenCalledTimes(3);
    } finally {
      await limpar();
    }
  }, 15000);

  it("transportadora MANUAL: fica de fora e a consulta nunca é chamada", async () => {
    const t = await criarTransportadora(CNPJ_MANUAL, "MANUAL");
    const nota = await criarNota(4, "TRANSITO", t.id);
    try {
      const consultar = vi.fn<Consultar>(async () => resposta([]));

      const r = await atualizarRastreioDaNota(nota.id, consultar);

      expect(r).toEqual({ nota: "9404", situacao: "ignorada", motivo: "Transportadora sem rastreio automático." });
      expect(consultar).not.toHaveBeenCalled();
    } finally {
      await limpar();
    }
  }, 15000);

  it("falha de rede (ok:false) não conta como 'não encontrada': a transportadora não acumula falha", async () => {
    // Começa com 2 falhas de verdade: se a rede contasse, a 3ª falha a deixaria ignorada.
    const t = await criarTransportadora(CNPJ_NAO_MAPEADA, "NAO_MAPEADA", 2);
    const nota = await criarNota(5, "TRANSITO", t.id);
    try {
      const consultar = vi.fn<Consultar>(async () => falhaDeRede);

      const primeira = await atualizarRastreioDaNota(nota.id, consultar);
      expect(primeira).toEqual({ nota: "9405", situacao: "falhou", motivo: "Tempo esgotado" });
      const depois = await prisma.transportadora.findUniqueOrThrow({ where: { id: t.id } });
      expect(depois.falhasSeguidas).toBe(2);
      expect(depois.ultimaConsultaEm).not.toBeNull();

      const segunda = await atualizarRastreioDaNota(nota.id, consultar);
      expect(segunda).toMatchObject({ situacao: "falhou" });
      expect(consultar).toHaveBeenCalledTimes(2);
    } finally {
      await limpar();
    }
  }, 15000);
});

describe("atualizarRastreiosEmAberto", () => {
  it("lote: consulta só notas em TRANSITO ou AGENDADO, e deixa de fora RECEBIDA e transportadora MANUAL", async () => {
    const tSsw = await criarTransportadora(CNPJ_LOTE, "SSW");
    const tManual = await criarTransportadora(CNPJ_MANUAL, "MANUAL");
    const emTransito = await criarNota(6, "TRANSITO", tSsw.id);
    const agendada = await criarNota(7, "AGENDADO", null);
    const recebida = await criarNota(8, "RECEBIDA", tSsw.id);
    const manual = await criarNota(9, "TRANSITO", tManual.id);
    try {
      const consultar = vi.fn<Consultar>(async () => falhaDeRede);

      const r = await atualizarRastreiosEmAberto(consultar, 0);

      const chamadas = consultar.mock.calls.map(([chave]) => chave);
      expect(chamadas).toEqual(expect.arrayContaining([emTransito.chaveAcesso, agendada.chaveAcesso]));
      expect(chamadas).not.toContain(recebida.chaveAcesso);
      expect(chamadas).not.toContain(manual.chaveAcesso);
      expect(r.consultadas).toBe(chamadas.length);
    } finally {
      await limpar();
    }
  }, 15000);
});
