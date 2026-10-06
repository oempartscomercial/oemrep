import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import { registrarEvento } from "../registrar";

let contador = 0;
// DDD 99 e prefixo 9 7xxx: números que não existem no seed nem nos dados da pasta rep.
function numeroDeTeste() {
  contador += 1;
  const sufixo = String(Date.now() + contador).slice(-6);
  const final = `97${sufixo.slice(0, 2)}-${sufixo.slice(2)}`;
  return { cadastro: `(99) 9 ${final}`, cadastroSemNove: `(99) ${final}`, e164: `+559999 7${sufixo}`.replace(" ", "") };
}

const evento = (jid: string, extra: { id: string; fromMe?: boolean; texto?: string; ts?: number; pushName?: string }) => ({
  event: "messages.upsert",
  instance: "oem",
  data: {
    key: { remoteJid: jid, fromMe: extra.fromMe ?? false, id: extra.id },
    pushName: extra.pushName,
    message: { conversation: extra.texto ?? "oi" },
    messageTimestamp: extra.ts ?? 1_791_300_000,
  },
});

async function empresaComContato(rotulo: string, valor: string, canal: "WHATSAPP" | "TELEFONE" = "WHATSAPP") {
  const empresa = await prisma.cliente.create({ data: { nomeFantasia: `Empresa WA ${rotulo}`, situacao: "CANDIDATA" } });
  const contato = await prisma.contato.create({
    data: { clienteId: empresa.id, nome: "Ana", canal, valor, fonte: "Site da empresa" },
  });
  return { empresa, contato };
}

async function limpar(numeros: string[], clienteIds: string[]) {
  const conversas = await prisma.conversa.findMany({ where: { numero: { in: numeros } }, select: { id: true } });
  const ids = conversas.map((c) => c.id);
  const eventos = await prisma.mensagem.findMany({ where: { conversaId: { in: ids } }, select: { eventoId: true } });
  await prisma.mensagem.deleteMany({ where: { conversaId: { in: ids } } });
  await prisma.conversa.deleteMany({ where: { id: { in: ids } } });
  await prisma.eventoWhatsapp.deleteMany({ where: { id: { in: eventos.flatMap((e) => (e.eventoId ? [e.eventoId] : [])) } } });
  await prisma.contato.deleteMany({ where: { clienteId: { in: clienteIds } } });
  await prisma.cliente.deleteMany({ where: { id: { in: clienteIds } } });
}

describe("registrarEvento — fase 1 do ADR-015", () => {
  it("grava a mensagem de um contato conhecido na conversa da empresa", async () => {
    const n = numeroDeTeste();
    const { empresa, contato } = await empresaComContato("a", n.cadastro);
    try {
      const r = await registrarEvento("PROSPECCAO", evento(`${n.e164.slice(1)}@s.whatsapp.net`, { id: "WA-A1", texto: "Pode mandar o catálogo", pushName: "Ana Compras" }));
      expect(r.resultados).toEqual(["mensagem"]);

      const conversa = await prisma.conversa.findUniqueOrThrow({
        where: { linha_numero: { linha: "PROSPECCAO", numero: n.e164 } },
        include: { mensagens: true },
      });
      expect(conversa).toMatchObject({ clienteId: empresa.id, contatoId: contato.id, motivoSemVinculo: null, nomeNoWhatsapp: "Ana Compras" });
      expect(conversa.mensagens).toHaveLength(1);
      expect(conversa.mensagens[0]).toMatchObject({
        direcao: "ENTRADA", origem: "CONTATO", tipo: "TEXTO", texto: "Pode mandar o catálogo", idExterno: "WA-A1", linha: "PROSPECCAO",
      });
      expect(conversa.mensagens[0].ocorridoEm).toEqual(new Date(1_791_300_000_000));

      const bruto = await prisma.eventoWhatsapp.findUniqueOrThrow({ where: { id: r.eventoId } });
      expect(bruto.processadoEm).not.toBeNull();
      expect(bruto.resultado).toBe("mensagem");
      expect(bruto.payload).toMatchObject({ event: "messages.upsert" });
    } finally {
      await limpar([n.e164], [empresa.id]);
    }
  });

  it("registra os dois lados na mesma conversa: o que o Rômulo digita no celular também entra", async () => {
    const n = numeroDeTeste();
    const { empresa } = await empresaComContato("b", n.cadastro);
    const jid = `${n.e164.slice(1)}@s.whatsapp.net`;
    try {
      await registrarEvento("PROSPECCAO", evento(jid, { id: "WA-B1", texto: "Olá, quem compra a linha?", fromMe: true, ts: 1_791_300_000 }));
      await registrarEvento("PROSPECCAO", evento(jid, { id: "WA-B2", texto: "Sou eu, pode falar", ts: 1_791_300_600 }));

      const conversa = await prisma.conversa.findUniqueOrThrow({
        where: { linha_numero: { linha: "PROSPECCAO", numero: n.e164 } },
        include: { mensagens: { orderBy: { ocorridoEm: "asc" } } },
      });
      expect(conversa.mensagens.map((m) => [m.direcao, m.origem])).toEqual([
        ["SAIDA", "ROMULO_NO_CELULAR"],
        ["ENTRADA", "CONTATO"],
      ]);
      expect(conversa.ultimaMensagemEm).toEqual(new Date(1_791_300_600_000));
    } finally {
      await limpar([n.e164], [empresa.id]);
    }
  });

  it("não duplica quando o mesmo evento chega de novo, mas guarda os dois eventos brutos", async () => {
    const n = numeroDeTeste();
    const { empresa } = await empresaComContato("c", n.cadastro);
    const corpo = evento(`${n.e164.slice(1)}@s.whatsapp.net`, { id: "WA-C1" });
    let segundo: string | undefined;
    try {
      await registrarEvento("PROSPECCAO", corpo);
      const r2 = await registrarEvento("PROSPECCAO", corpo);
      segundo = r2.eventoId;
      expect(r2.resultados).toEqual(["duplicada"]);
      const conversa = await prisma.conversa.findUniqueOrThrow({ where: { linha_numero: { linha: "PROSPECCAO", numero: n.e164 } } });
      expect(await prisma.mensagem.count({ where: { conversaId: conversa.id } })).toBe(1);
    } finally {
      await limpar([n.e164], [empresa.id]);
      if (segundo) await prisma.eventoWhatsapp.deleteMany({ where: { id: segundo } });
    }
  });

  it("casa o número mesmo quando o cadastro está sem o 9 do celular", async () => {
    const n = numeroDeTeste();
    const { empresa } = await empresaComContato("d", n.cadastroSemNove, "TELEFONE");
    try {
      await registrarEvento("PROSPECCAO", evento(`${n.e164.slice(1)}@s.whatsapp.net`, { id: "WA-D1" }));
      const conversa = await prisma.conversa.findUniqueOrThrow({ where: { linha_numero: { linha: "PROSPECCAO", numero: n.e164 } } });
      expect(conversa.clienteId).toBe(empresa.id);
    } finally {
      await limpar([n.e164], [empresa.id]);
    }
  });

  it("número que ninguém cadastrou fica sem empresa, com o motivo", async () => {
    const n = numeroDeTeste();
    try {
      await registrarEvento("PROSPECCAO", evento(`${n.e164.slice(1)}@s.whatsapp.net`, { id: "WA-E1", pushName: "Desconhecido" }));
      const conversa = await prisma.conversa.findUniqueOrThrow({ where: { linha_numero: { linha: "PROSPECCAO", numero: n.e164 } } });
      expect(conversa).toMatchObject({ clienteId: null, contatoId: null, motivoSemVinculo: "numero_desconhecido" });
    } finally {
      await limpar([n.e164], []);
    }
  });

  it("número em duas empresas não é atribuído a nenhuma", async () => {
    const n = numeroDeTeste();
    const a = await empresaComContato("f1", n.cadastro);
    const b = await empresaComContato("f2", n.cadastro);
    try {
      await registrarEvento("PROSPECCAO", evento(`${n.e164.slice(1)}@s.whatsapp.net`, { id: "WA-F1" }));
      const conversa = await prisma.conversa.findUniqueOrThrow({ where: { linha_numero: { linha: "PROSPECCAO", numero: n.e164 } } });
      expect(conversa).toMatchObject({ clienteId: null, motivoSemVinculo: "numero_em_varias_empresas" });
    } finally {
      await limpar([n.e164], [a.empresa.id, b.empresa.id]);
    }
  });

  it("conversa sem empresa é ligada quando o contato passa a existir e chega nova mensagem", async () => {
    const n = numeroDeTeste();
    let empresaId: string | undefined;
    try {
      const jid = `${n.e164.slice(1)}@s.whatsapp.net`;
      await registrarEvento("PROSPECCAO", evento(jid, { id: "WA-G1" }));
      const { empresa } = await empresaComContato("g", n.cadastro);
      empresaId = empresa.id;
      await registrarEvento("PROSPECCAO", evento(jid, { id: "WA-G2", ts: 1_791_300_900 }));
      const conversa = await prisma.conversa.findUniqueOrThrow({ where: { linha_numero: { linha: "PROSPECCAO", numero: n.e164 } } });
      expect(conversa).toMatchObject({ clienteId: empresa.id, motivoSemVinculo: null });
    } finally {
      await limpar([n.e164], empresaId ? [empresaId] : []);
    }
  });

  it("o que não é conversa individual deixa só o evento bruto, com o motivo", async () => {
    const grupo = await registrarEvento("PROSPECCAO", evento("120363025246125486@g.us", { id: "WA-H1" }));
    const lid = await registrarEvento("PROSPECCAO", evento("99887766554433@lid", { id: "WA-H2" }));
    try {
      expect(grupo.resultados).toEqual(["ignorado: mensagem de grupo"]);
      expect(lid.resultados[0]).toMatch(/^sem_numero: identificador interno/);
      expect(await prisma.conversa.count({ where: { numero: { in: ["+120363025246125486", "+99887766554433"] } } })).toBe(0);
      const guardado = await prisma.eventoWhatsapp.findUniqueOrThrow({ where: { id: lid.eventoId } });
      expect(guardado.resultado).toMatch(/^sem_numero/);
    } finally {
      await prisma.eventoWhatsapp.deleteMany({ where: { id: { in: [grupo.eventoId, lid.eventoId] } } });
    }
  });

  it("mensagem sem horário usa o momento da chegada", async () => {
    const n = numeroDeTeste();
    const antes = Date.now();
    try {
      const corpo = evento(`${n.e164.slice(1)}@s.whatsapp.net`, { id: "WA-I1" });
      delete (corpo.data as Record<string, unknown>).messageTimestamp;
      await registrarEvento("PROSPECCAO", corpo);
      const m = await prisma.mensagem.findFirstOrThrow({ where: { idExterno: "WA-I1" } });
      expect(m.ocorridoEm.getTime()).toBeGreaterThanOrEqual(antes - 1000);
    } finally {
      await limpar([n.e164], []);
    }
  });
});
