import { describe, it, expect, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { despachar } from "../despachar";
import { ErroDeEnvio, type TransporteWhatsapp } from "../transporte";

let contador = 0;
const sp = (iso: string) => new Date(`${iso}-03:00`);
const QUARTA_10H = sp("2026-10-07T10:00:00");

function transporte(extra: Partial<TransporteWhatsapp> = {}): TransporteWhatsapp & { enviarTexto: ReturnType<typeof vi.fn> } {
  return {
    nome: "teste",
    estado: async () => "conectada",
    enviarTexto: vi.fn(async () => ({ idExterno: "WA-ENVIADO-1" })),
    ...extra,
  } as TransporteWhatsapp & { enviarTexto: ReturnType<typeof vi.fn> };
}

// DDD 97: espaço de números próprio deste arquivo (os outros usam 98 e 99).
async function cenario(opcoes: { situacao?: "APROVADA" | "EM_CONTATO" | "CONVERSANDO" | "CANDIDATA"; tipo?: "PRIMEIRO_CONTATO" | "FOLLOW_UP" | "RESPOSTA"; origem?: boolean; texto?: string } = {}) {
  contador += 1;
  const sufixo = String(Date.now() + contador).slice(-6);
  const e164 = `+5597997${sufixo}`;
  const usuario = await prisma.usuario.create({ data: { nome: "Aprovador", email: `desp-${sufixo}@teste.local`, perfil: "ANALISTA" } });
  const empresa = await prisma.cliente.create({ data: { nomeFantasia: `Empresa Despacho ${sufixo}`, situacao: opcoes.situacao ?? "APROVADA" } });
  const contato = await prisma.contato.create({
    data: {
      clienteId: empresa.id, nome: "Ana", canal: "WHATSAPP", valor: `(97) 9 97${sufixo.slice(0, 2)}-${sufixo.slice(2)}`, fonte: "Site",
      origemContato: opcoes.origem === false ? null : "PUBLICADO_PELA_EMPRESA",
    },
  });
  const conversa = await prisma.conversa.create({
    data: { linha: "PROSPECCAO", numero: e164, clienteId: empresa.id, contatoId: contato.id, ultimaMensagemEm: new Date() },
  });
  const mensagem = await prisma.mensagem.create({
    data: {
      conversaId: conversa.id, linha: "PROSPECCAO", direcao: "SAIDA", origem: "PLATAFORMA", tipo: "TEXTO", status: "APROVADA",
      tipoEnvio: opcoes.tipo ?? "PRIMEIRO_CONTATO", texto: opcoes.texto ?? "Olá, tudo bem? Quem cuida da compra dessa linha aí?",
      ocorridoEm: new Date(), criadaPorId: usuario.id, aprovadaPorId: usuario.id, aprovadaEm: new Date(),
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
  return { e164, usuario, empresa, contato, conversa, mensagem, limpar };
}
const recarregar = (id: string) => prisma.mensagem.findUniqueOrThrow({ where: { id } });

describe("despachar — envio de mensagem aprovada (ADR-015 §3 e §4)", () => {
  it("envia, grava o id do WhatsApp e leva a empresa de 'aprovada' para 'em contato' com passo de acompanhar", async () => {
    const c = await cenario();
    try {
      const t = transporte();
      const r = await despachar(c.mensagem.id, { transporte: t, agora: QUARTA_10H });
      expect(r.status).toBe("ENVIADA");
      expect(t.enviarTexto).toHaveBeenCalledWith(c.e164, "Olá, tudo bem? Quem cuida da compra dessa linha aí?");
      expect(await recarregar(c.mensagem.id)).toMatchObject({ status: "ENVIADA", idExterno: "WA-ENVIADO-1", erro: null, motivoBloqueio: null });

      expect((await prisma.cliente.findUniqueOrThrow({ where: { id: c.empresa.id } })).situacao).toBe("EM_CONTATO");
      const passos = await prisma.proximoPasso.findMany({ where: { clienteId: c.empresa.id, concluidoEm: null } });
      expect(passos).toHaveLength(1);
      expect(passos[0]).toMatchObject({ acao: "Acompanhar resposta de Ana", responsavelId: c.usuario.id });
      const interacao = await prisma.interacao.findFirstOrThrow({ where: { clienteId: c.empresa.id } });
      expect(interacao).toMatchObject({ origem: "AUTOMACAO", canal: "WHATSAPP" });
      expect(interacao.resumo).toContain("Aprovada → Em contato (movido automaticamente)");
    } finally {
      await c.limpar();
    }
  });

  it("fora do horário comercial a mensagem fica aprovada, com o motivo, e nada é enviado", async () => {
    const c = await cenario();
    try {
      const t = transporte();
      const r = await despachar(c.mensagem.id, { transporte: t, agora: sp("2026-10-10T11:00:00") });
      expect(r.status).toBe("APROVADA");
      expect(t.enviarTexto).not.toHaveBeenCalled();
      const m = await recarregar(c.mensagem.id);
      expect(m.status).toBe("APROVADA");
      expect(m.motivoBloqueio).toContain("Fora do horário comercial");
    } finally {
      await c.limpar();
    }
  });

  it("linha caída também espera", async () => {
    const c = await cenario();
    try {
      const t = transporte({ estado: async () => "desconectada" });
      const r = await despachar(c.mensagem.id, { transporte: t, agora: QUARTA_10H });
      expect(r.status).toBe("APROVADA");
      expect((await recarregar(c.mensagem.id)).motivoBloqueio).toContain("não está conectado");
    } finally {
      await c.limpar();
    }
  });

  it("bloqueio definitivo cancela: contato que pediu para não ser contatado", async () => {
    const c = await cenario();
    try {
      await prisma.contato.update({ where: { id: c.contato.id }, data: { naoContatar: true } });
      const t = transporte();
      const r = await despachar(c.mensagem.id, { transporte: t, agora: QUARTA_10H });
      expect(r.status).toBe("CANCELADA");
      expect(t.enviarTexto).not.toHaveBeenCalled();
      expect((await recarregar(c.mensagem.id)).motivoBloqueio).toContain("não ser contatado");
    } finally {
      await c.limpar();
    }
  });

  it("sem origem do contato ou com empresa ainda candidata, não sai", async () => {
    const sem = await cenario({ origem: false });
    const cand = await cenario({ situacao: "CANDIDATA" });
    try {
      const t = transporte();
      expect((await despachar(sem.mensagem.id, { transporte: t, agora: QUARTA_10H })).status).toBe("CANCELADA");
      expect((await despachar(cand.mensagem.id, { transporte: t, agora: QUARTA_10H })).status).toBe("CANCELADA");
      expect(t.enviarTexto).not.toHaveBeenCalled();
    } finally {
      await sem.limpar();
      await cand.limpar();
    }
  });

  it("só despacha mensagem aprovada: rascunho e já enviada são ignorados", async () => {
    const c = await cenario();
    try {
      const t = transporte();
      await prisma.mensagem.update({ where: { id: c.mensagem.id }, data: { status: "RASCUNHO" } });
      expect((await despachar(c.mensagem.id, { transporte: t, agora: QUARTA_10H })).status).toBe("IGNORADA");
      await prisma.mensagem.update({ where: { id: c.mensagem.id }, data: { status: "ENVIADA" } });
      expect((await despachar(c.mensagem.id, { transporte: t, agora: QUARTA_10H })).status).toBe("IGNORADA");
      expect(t.enviarTexto).not.toHaveBeenCalled();
    } finally {
      await c.limpar();
    }
  });

  it("dois despachos ao mesmo tempo enviam uma vez só", async () => {
    const c = await cenario();
    try {
      const t = transporte();
      const [a, b] = await Promise.all([
        despachar(c.mensagem.id, { transporte: t, agora: QUARTA_10H }),
        despachar(c.mensagem.id, { transporte: t, agora: QUARTA_10H }),
      ]);
      expect(t.enviarTexto).toHaveBeenCalledTimes(1);
      expect([a.status, b.status].sort()).toEqual(["ENVIADA", "IGNORADA"]);
    } finally {
      await c.limpar();
    }
  });

  it("recusa certa do WhatsApp: FALHOU com o erro e a empresa não muda de etapa", async () => {
    const c = await cenario();
    try {
      const t = transporte({ enviarTexto: vi.fn(async () => { throw new ErroDeEnvio("O WhatsApp recusou a mensagem (HTTP 400).", true); }) });
      const r = await despachar(c.mensagem.id, { transporte: t, agora: QUARTA_10H });
      expect(r.status).toBe("FALHOU");
      expect(await recarregar(c.mensagem.id)).toMatchObject({ status: "FALHOU", erro: "O WhatsApp recusou a mensagem (HTTP 400)." });
      expect((await prisma.cliente.findUniqueOrThrow({ where: { id: c.empresa.id } })).situacao).toBe("APROVADA");
    } finally {
      await c.limpar();
    }
  });

  it("resposta perdida: FALHOU avisando para conferir no celular antes de tentar de novo", async () => {
    const c = await cenario();
    try {
      const t = transporte({ enviarTexto: vi.fn(async () => { throw new ErroDeEnvio("Sem resposta do WhatsApp: timeout", false); }) });
      await despachar(c.mensagem.id, { transporte: t, agora: QUARTA_10H });
      const m = await recarregar(c.mensagem.id);
      expect(m.status).toBe("FALHOU");
      expect(m.erro).toContain("confira no celular");
    } finally {
      await c.limpar();
    }
  });

  it("limite de primeiros contatos do dia segura o envio (espera, não cancela)", async () => {
    const c = await cenario();
    const outro = await cenario();
    try {
      await prisma.parametro.upsert({ where: { chave: "whatsapp_limite_primeiros_dia" }, update: { valor: "1" }, create: { chave: "whatsapp_limite_primeiros_dia", valor: "1" } });
      await prisma.mensagem.update({ where: { id: outro.mensagem.id }, data: { status: "ENVIADA", idExterno: "LIM-1", enviadaEm: sp("2026-10-07T09:00:00") } });
      const t = transporte();
      const r = await despachar(c.mensagem.id, { transporte: t, agora: QUARTA_10H });
      expect(r.status).toBe("APROVADA");
      expect(t.enviarTexto).not.toHaveBeenCalled();
      expect((await recarregar(c.mensagem.id)).motivoBloqueio).toContain("Limite de 1 primeiros contatos por dia");
    } finally {
      await prisma.parametro.deleteMany({ where: { chave: "whatsapp_limite_primeiros_dia" } });
      await c.limpar();
      await outro.limpar();
    }
  });
});

describe("despachar — follow-up e resposta", () => {
  it("follow-up enviado em 'em contato' renova o passo de acompanhar", async () => {
    const c = await cenario({ situacao: "EM_CONTATO", tipo: "FOLLOW_UP", texto: "Passando para saber se viu a mensagem." });
    try {
      await prisma.mensagem.create({
        data: {
          conversaId: c.conversa.id, linha: "PROSPECCAO", direcao: "SAIDA", origem: "PLATAFORMA", tipo: "TEXTO", status: "ENVIADA",
          tipoEnvio: "PRIMEIRO_CONTATO", texto: "Primeira", ocorridoEm: new Date(QUARTA_10H.getTime() - 4 * 86_400_000), idExterno: "FU-1",
        },
      });
      await prisma.proximoPasso.create({ data: { clienteId: c.empresa.id, acao: "Acompanhar resposta de Ana", prazo: new Date("2026-10-06T00:00:00Z"), responsavelId: c.usuario.id } });
      const r = await despachar(c.mensagem.id, { transporte: transporte(), agora: QUARTA_10H });
      expect(r.status).toBe("ENVIADA");
      const abertos = await prisma.proximoPasso.findMany({ where: { clienteId: c.empresa.id, concluidoEm: null } });
      expect(abertos).toHaveLength(1);
      expect(abertos[0].prazo.toISOString().slice(0, 10)).toBe("2026-10-12"); // 07/10 + 3 dias = sábado → segunda
    } finally {
      await c.limpar();
    }
  });

  it("resposta enviada não mexe em etapa nem em passos", async () => {
    const c = await cenario({ situacao: "CONVERSANDO", tipo: "RESPOSTA", texto: "Segue o catálogo." });
    try {
      await prisma.mensagem.create({
        data: { conversaId: c.conversa.id, linha: "PROSPECCAO", direcao: "ENTRADA", origem: "CONTATO", tipo: "TEXTO", status: "RECEBIDA", texto: "Pode mandar?", ocorridoEm: new Date(QUARTA_10H.getTime() - 3_600_000), idExterno: "RE-1" },
      });
      const r = await despachar(c.mensagem.id, { transporte: transporte(), agora: QUARTA_10H });
      expect(r.status).toBe("ENVIADA");
      expect(await prisma.proximoPasso.count({ where: { clienteId: c.empresa.id } })).toBe(0);
      expect((await prisma.cliente.findUniqueOrThrow({ where: { id: c.empresa.id } })).situacao).toBe("CONVERSANDO");
    } finally {
      await c.limpar();
    }
  });
});
