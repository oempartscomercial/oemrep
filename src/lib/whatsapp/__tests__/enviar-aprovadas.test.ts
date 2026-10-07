import { describe, it, expect, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { enviarAprovadas } from "../enviar-aprovadas";
import { ErroDeEnvio, obterTransporte, type TransporteWhatsapp } from "../transporte";

let contador = 0;
const sp = (iso: string) => new Date(`${iso}-03:00`);
const QUARTA_10H = sp("2026-10-07T10:00:00");
const MOTIVO_VENCIDA = "Aprovada há mais de 7 dias sem conseguir enviar.";

// DDD 95: espaço de números próprio deste arquivo (os outros usam 97, 98 e 99).
function transporte(extra: Partial<TransporteWhatsapp> = {}) {
  return {
    nome: "teste",
    estado: async () => "conectada",
    enviarTexto: vi.fn(async () => ({ idExterno: `WA-${randomUUID()}` })),
    ...extra,
  } as TransporteWhatsapp & { enviarTexto: ReturnType<typeof vi.fn> };
}

async function cenario(opcoes: { aprovadaEm?: Date; status?: "APROVADA" | "ENVIANDO" | "FALHOU" } = {}) {
  contador += 1;
  const sufixo = String(Date.now() + contador).slice(-6);
  const e164 = `+5595996${sufixo}`;
  const usuario = await prisma.usuario.create({ data: { nome: "Aprovador", email: `agend-${sufixo}@teste.local`, perfil: "ANALISTA" } });
  const empresa = await prisma.cliente.create({ data: { nomeFantasia: `Empresa Agendada ${sufixo}`, situacao: "APROVADA" } });
  const contato = await prisma.contato.create({
    data: {
      clienteId: empresa.id, nome: "Ana", canal: "WHATSAPP", valor: `(95) 9 96${sufixo.slice(0, 2)}-${sufixo.slice(2)}`, fonte: "Site",
      origemContato: "PUBLICADO_PELA_EMPRESA",
    },
  });
  const conversa = await prisma.conversa.create({
    data: { linha: "PROSPECCAO", numero: e164, clienteId: empresa.id, contatoId: contato.id, ultimaMensagemEm: new Date() },
  });
  const mensagem = await prisma.mensagem.create({
    data: {
      conversaId: conversa.id, linha: "PROSPECCAO", direcao: "SAIDA", origem: "PLATAFORMA", tipo: "TEXTO",
      status: opcoes.status ?? "APROVADA", tipoEnvio: "PRIMEIRO_CONTATO", texto: `Olá, tudo bem? Quem cuida da compra? (${sufixo})`,
      ocorridoEm: new Date(), criadaPorId: usuario.id, aprovadaPorId: usuario.id, aprovadaEm: opcoes.aprovadaEm ?? sp("2026-10-06T10:00:00"),
    },
  });
  const limpar = async () => {
    await prisma.mensagem.deleteMany({ where: { conversaId: conversa.id } });
    await prisma.conversa.delete({ where: { id: conversa.id } });
    await prisma.interacao.deleteMany({ where: { clienteId: empresa.id } });
    await prisma.proximoPasso.deleteMany({ where: { clienteId: empresa.id } });
    await prisma.contato.deleteMany({ where: { clienteId: empresa.id } });
    await prisma.cliente.delete({ where: { id: empresa.id } });
    await prisma.usuario.delete({ where: { id: usuario.id } });
  };
  return { e164, usuario, empresa, conversa, mensagem, limpar };
}


// Transforma a mensagem do cenário em follow-up: a empresa já está em contato e houve um
// primeiro contato enviado em `ultimoEnvio`.
async function comoFollowUp(c: Awaited<ReturnType<typeof cenario>>, ultimoEnvio: Date) {
  await prisma.cliente.update({ where: { id: c.empresa.id }, data: { situacao: "EM_CONTATO" } });
  await prisma.mensagem.create({
    data: {
      conversaId: c.conversa.id, linha: "PROSPECCAO", direcao: "SAIDA", origem: "PLATAFORMA", tipo: "TEXTO", status: "ENVIADA",
      tipoEnvio: "PRIMEIRO_CONTATO", texto: `Primeira mensagem (${c.e164})`, ocorridoEm: ultimoEnvio, enviadaEm: ultimoEnvio,
      idExterno: `PRIM-${c.e164}`, criadaPorId: c.usuario.id, aprovadaPorId: c.usuario.id, aprovadaEm: ultimoEnvio,
    },
  });
  await prisma.mensagem.update({ where: { id: c.mensagem.id }, data: { tipoEnvio: "FOLLOW_UP" } });
}

// Os testes de limite diário usam um dia só deles (2027-03-03): a contagem é por dia, então os
// outros testes, que enviam em 2026, não entram na conta nem sofrem com ela. O limite padrão
// (15) é atingido com 15 primeiros contatos já enviados nesse dia; nada mexe em parâmetro global.
const DIA_LIMITE_ANTES = "2027-03-02";
const DIA_LIMITE_10H = sp("2027-03-03T10:00:00");
async function encherODia(c: Awaited<ReturnType<typeof cenario>>) {
  const quando = sp("2027-03-03T09:00:00");
  await prisma.mensagem.createMany({
    data: Array.from({ length: 15 }, (_, i) => ({
      conversaId: c.conversa.id, linha: "PROSPECCAO" as const, direcao: "SAIDA" as const, origem: "PLATAFORMA" as const, tipo: "TEXTO" as const,
      status: "ENVIADA" as const, tipoEnvio: "PRIMEIRO_CONTATO" as const, texto: `Enchendo o dia ${i} (${c.e164})`, ocorridoEm: quando, enviadaEm: quando,
      idExterno: `CHEIO-${c.e164}-${i}`, criadaPorId: c.usuario.id, aprovadaPorId: c.usuario.id, aprovadaEm: quando,
    })),
  });
}

const recarregar = (id: string) => prisma.mensagem.findUniqueOrThrow({ where: { id } });

describe("enviarAprovadas — envio agendado das aprovadas (ADR-015 §4)", () => {
  it("manda uma de cada vez, na ordem de aprovação (as mais antigas primeiro), e conta o resumo", async () => {
    const recente = await cenario({ aprovadaEm: sp("2026-10-06T10:00:00") });
    const antiga = await cenario({ aprovadaEm: sp("2026-10-05T10:00:00") });
    try {
      let emVoo = 0;
      let pico = 0;
      const t = transporte({
        enviarTexto: vi.fn(async () => {
          emVoo += 1;
          pico = Math.max(pico, emVoo);
          await new Promise((resolver) => setTimeout(resolver, 20));
          emVoo -= 1;
          return { idExterno: `WA-${randomUUID()}` };
        }),
      });
      const r = await enviarAprovadas({ transporte: t, agora: QUARTA_10H, mensagemIds: [recente.mensagem.id, antiga.mensagem.id] });
      expect(r).toEqual({ enviadas: 2, aguardando: 0, canceladas: 0 });
      expect(t.enviarTexto.mock.calls.map((c) => c[0])).toEqual([antiga.e164, recente.e164]);
      expect(pico).toBe(1);
      expect((await recarregar(antiga.mensagem.id)).status).toBe("ENVIADA");
      expect((await recarregar(recente.mensagem.id)).status).toBe("ENVIADA");
    } finally {
      await recente.limpar();
      await antiga.limpar();
    }
  });

  it("linha desconectada: para na primeira, deixa as demais aprovadas e não envia nada", async () => {
    const a = await cenario({ aprovadaEm: sp("2026-10-05T10:00:00") });
    const b = await cenario({ aprovadaEm: sp("2026-10-06T10:00:00") });
    try {
      const t = transporte({ estado: async () => "desconectada" });
      const r = await enviarAprovadas({ transporte: t, agora: QUARTA_10H, mensagemIds: [b.mensagem.id, a.mensagem.id] });
      expect(r).toMatchObject({ enviadas: 0, aguardando: 2, canceladas: 0 });
      expect(r.paradasPor).toContain("desconectado");
      expect(t.enviarTexto).not.toHaveBeenCalled();
      expect((await recarregar(a.mensagem.id)).motivoBloqueio).toContain("não está conectado");
      expect((await recarregar(b.mensagem.id)).status).toBe("APROVADA");
    } finally {
      await a.limpar();
      await b.limpar();
    }
  });

  it("envio desligado neste ambiente: sem erro, o motivo fica registrado e o lote para", async () => {
    const a = await cenario({ aprovadaEm: sp("2026-10-05T10:00:00") });
    try {
      const r = await enviarAprovadas({ transporte: obterTransporte({}), agora: QUARTA_10H, mensagemIds: [a.mensagem.id] });
      expect(r).toMatchObject({ enviadas: 0, aguardando: 1, canceladas: 0 });
      expect(r.paradasPor).toBeDefined();
      expect((await recarregar(a.mensagem.id)).motivoBloqueio).toContain("não está conectado");
    } finally {
      await a.limpar();
    }
  });

  it("limite diário de primeiros contatos: para antes de insistir, só nos primeiros contatos", async () => {
    const a = await cenario({ aprovadaEm: sp(`${DIA_LIMITE_ANTES}T10:00:00`) });
    const b = await cenario({ aprovadaEm: sp(`${DIA_LIMITE_ANTES}T11:00:00`) });
    const ja = await cenario();
    try {
      await encherODia(ja);
      const t = transporte();
      const r = await enviarAprovadas({ transporte: t, agora: DIA_LIMITE_10H, mensagemIds: [a.mensagem.id, b.mensagem.id] });
      expect(r).toMatchObject({ enviadas: 0, aguardando: 2, canceladas: 0 });
      expect(r.paradasPor).toContain("Limite diário");
      expect(t.enviarTexto).not.toHaveBeenCalled();
      expect((await recarregar(b.mensagem.id)).status).toBe("APROVADA");
    } finally {
      await a.limpar();
      await b.limpar();
      await ja.limpar();
    }
  });

  it("limite diário de primeiros contatos não segura o follow-up que vem depois", async () => {
    const primeiro = await cenario({ aprovadaEm: sp(`${DIA_LIMITE_ANTES}T10:00:00`) });
    const follow = await cenario({ aprovadaEm: sp(`${DIA_LIMITE_ANTES}T11:00:00`) });
    const ja = await cenario();
    try {
      await encherODia(ja);
      await comoFollowUp(follow, sp("2027-02-20T10:00:00"));
      const t = transporte();
      const r = await enviarAprovadas({ transporte: t, agora: DIA_LIMITE_10H, mensagemIds: [primeiro.mensagem.id, follow.mensagem.id] });
      expect(r).toMatchObject({ enviadas: 1, aguardando: 1 });
      expect(r.paradasPor).toContain("Limite diário");
      expect((await recarregar(primeiro.mensagem.id)).status).toBe("APROVADA");
      expect((await recarregar(follow.mensagem.id)).status).toBe("ENVIADA");
    } finally {
      await primeiro.limpar();
      await follow.limpar();
      await ja.limpar();
    }
  });

  it("mensagem que só espera (intervalo) não ocupa a vaga do lote", async () => {
    const cedo = await cenario({ aprovadaEm: sp("2026-10-05T10:00:00") });
    const pronta = await cenario({ aprovadaEm: sp("2026-10-06T10:00:00") });
    try {
      await comoFollowUp(cedo, sp("2026-10-06T10:00:00")); // há 1 dia: ainda no intervalo de 3 dias
      const t = transporte();
      const r = await enviarAprovadas({ transporte: t, agora: QUARTA_10H, limite: 1, mensagemIds: [cedo.mensagem.id, pronta.mensagem.id] });
      expect(r).toMatchObject({ enviadas: 1, aguardando: 1 });
      expect((await recarregar(cedo.mensagem.id)).status).toBe("APROVADA");
      expect((await recarregar(pronta.mensagem.id)).status).toBe("ENVIADA");
    } finally {
      await prisma.mensagem.deleteMany({ where: { idExterno: { startsWith: "PRIM-" }, conversaId: { in: [cedo.conversa.id] } } });
      await cedo.limpar();
      await pronta.limpar();
    }
  });

  it("respeita o limite do lote: com limite 1, manda só a mais antiga", async () => {
    const a = await cenario({ aprovadaEm: sp("2026-10-05T10:00:00") });
    const b = await cenario({ aprovadaEm: sp("2026-10-06T10:00:00") });
    try {
      const t = transporte();
      const r = await enviarAprovadas({ transporte: t, agora: QUARTA_10H, limite: 1, mensagemIds: [b.mensagem.id, a.mensagem.id] });
      expect(r).toEqual({ enviadas: 1, aguardando: 1, canceladas: 0 });
      expect(t.enviarTexto.mock.calls.map((c) => c[0])).toEqual([a.e164]);
    } finally {
      await a.limpar();
      await b.limpar();
    }
  });

  it("aprovação com mais de 7 dias é cancelada em vez de enviada, mesmo com a linha caída", async () => {
    const vencida = await cenario({ aprovadaEm: sp("2026-09-29T10:00:00") });
    const dentro = await cenario({ aprovadaEm: sp("2026-10-01T10:00:00") });
    try {
      const t = transporte({ estado: async () => "desconectada" });
      const r = await enviarAprovadas({ transporte: t, agora: QUARTA_10H, mensagemIds: [vencida.mensagem.id, dentro.mensagem.id] });
      expect(r).toMatchObject({ enviadas: 0, aguardando: 1, canceladas: 1 });
      expect(r.paradasPor).toBeDefined();
      expect(await recarregar(vencida.mensagem.id)).toMatchObject({ status: "CANCELADA", motivoBloqueio: MOTIVO_VENCIDA });
      expect((await recarregar(dentro.mensagem.id)).status).toBe("APROVADA");
      expect(t.enviarTexto).not.toHaveBeenCalled();
    } finally {
      await vencida.limpar();
      await dentro.limpar();
    }
  });

  it("nunca toca em mensagem ENVIANDO ou FALHOU, mesmo antiga", async () => {
    const enviando = await cenario({ status: "ENVIANDO", aprovadaEm: sp("2026-09-01T10:00:00") });
    const falhou = await cenario({ status: "FALHOU", aprovadaEm: sp("2026-09-01T10:00:00") });
    try {
      const t = transporte();
      const r = await enviarAprovadas({ transporte: t, agora: QUARTA_10H, mensagemIds: [enviando.mensagem.id, falhou.mensagem.id] });
      expect(r).toEqual({ enviadas: 0, aguardando: 0, canceladas: 0 });
      expect(t.enviarTexto).not.toHaveBeenCalled();
      expect((await recarregar(enviando.mensagem.id)).status).toBe("ENVIANDO");
      expect((await recarregar(falhou.mensagem.id)).status).toBe("FALHOU");
    } finally {
      await enviando.limpar();
      await falhou.limpar();
    }
  });

  it("recusa certa do WhatsApp: a primeira vira FALHOU e o lote para sem tentar as demais", async () => {
    const a = await cenario({ aprovadaEm: sp("2026-10-05T10:00:00") });
    const b = await cenario({ aprovadaEm: sp("2026-10-06T10:00:00") });
    try {
      const t = transporte({
        enviarTexto: vi.fn(async () => {
          throw new ErroDeEnvio("O WhatsApp recusou a mensagem (HTTP 400).", true);
        }),
      });
      const r = await enviarAprovadas({ transporte: t, agora: QUARTA_10H, mensagemIds: [b.mensagem.id, a.mensagem.id] });
      expect(r).toMatchObject({ enviadas: 0, aguardando: 1, canceladas: 0 });
      expect(r.paradasPor).toContain("Falha");
      expect(t.enviarTexto.mock.calls.map((c) => c[0])).toEqual([a.e164]);
      expect((await recarregar(a.mensagem.id)).status).toBe("FALHOU");
      expect((await recarregar(b.mensagem.id)).status).toBe("APROVADA");
    } finally {
      await a.limpar();
      await b.limpar();
    }
  });
});
