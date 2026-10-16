import { describe, it, expect, vi, afterEach } from "vitest";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { salvarEvolution } from "@/lib/integracoes/config";
import { registrarEvento } from "../registrar";

// O Rômulo pode conectar o próprio WhatsApp, com conversas pessoais (ADR-019): o sistema só guarda
// mensagens de números que estão na base (contato cadastrado ou conversa que já existe). O resto
// não deixa rastro, nem o evento bruto.

let contador = 0;
// DDD 92: espaço de números próprio deste arquivo.
function numeroDeTeste() {
  contador += 1;
  const sufixo = String(Date.now() + contador).slice(-6);
  return { cadastro: `(92) 9 96${sufixo.slice(0, 2)}-${sufixo.slice(2)}`, e164: `+5592996${sufixo}` };
}
const jid = (e164: string) => `${e164.slice(1)}@s.whatsapp.net`;
const mensagem = (evento: string, e164: string, id: string, texto: string, fromMe = false) => ({
  event: evento,
  instance: "prospeccao",
  data: { key: { remoteJid: jid(e164), fromMe, id }, pushName: "Ana", message: { conversation: texto }, messageTimestamp: Math.floor(Date.now() / 1000) },
});
const eventosCom = (marca: string) => prisma.eventoWhatsapp.count({ where: { payload: { path: ["data", "key", "id"], equals: marca } } });

async function empresa(situacao: "APROVADA" | "EM_CONTATO" | "CONVERSANDO" = "CONVERSANDO") {
  const n = numeroDeTeste();
  const aprovador = await prisma.usuario.create({ data: { nome: "Aprovador Base", email: `base-${n.e164.slice(-8)}@teste.local`, perfil: "ADMIN" } });
  const cliente = await prisma.cliente.create({ data: { nomeFantasia: `Empresa Base ${n.e164.slice(-6)}`, situacao } });
  const contato = await prisma.contato.create({ data: { clienteId: cliente.id, nome: "Ana", canal: "WHATSAPP", valor: n.cadastro, fonte: "Site", origemContato: "PUBLICADO_PELA_EMPRESA" } });
  const limpar = async () => {
    const conversas = await prisma.conversa.findMany({ where: { numero: n.e164 }, select: { id: true } });
    const ids = conversas.map((c) => c.id);
    const eventos = await prisma.mensagem.findMany({ where: { conversaId: { in: ids } }, select: { eventoId: true } });
    await prisma.mensagem.deleteMany({ where: { conversaId: { in: ids } } });
    await prisma.conversa.deleteMany({ where: { id: { in: ids } } });
    await prisma.eventoWhatsapp.deleteMany({ where: { id: { in: eventos.flatMap((e) => (e.eventoId ? [e.eventoId] : [])) } } });
    await prisma.interacao.deleteMany({ where: { clienteId: cliente.id } });
    await prisma.proximoPasso.deleteMany({ where: { clienteId: cliente.id } });
    await prisma.contato.deleteMany({ where: { clienteId: cliente.id } });
    await prisma.cliente.delete({ where: { id: cliente.id } });
    await prisma.usuario.delete({ where: { id: aprovador.id } });
  };
  return { n, aprovador, cliente, contato, limpar };
}

afterEach(() => vi.unstubAllEnvs());

describe("webhook — só números da base", () => {
  it("contato cadastrado: guarda o evento, cria a conversa e a mensagem", async () => {
    const e = await empresa();
    try {
      const r = await registrarEvento("PROSPECCAO", mensagem("messages.upsert", e.n.e164, "BASE-1", "Bom dia, recebi sua mensagem"));
      expect(r.resultados).toEqual(["mensagem"]);
      expect(r.eventoId).toBeTruthy();
      const conversa = await prisma.conversa.findUniqueOrThrow({ where: { linha_numero: { linha: "PROSPECCAO", numero: e.n.e164 } } });
      expect(conversa).toMatchObject({ clienteId: e.cliente.id, contatoId: e.contato.id });
      expect(await eventosCom("BASE-1")).toBe(1);
    } finally {
      await e.limpar();
    }
  });

  it("número de fora (conversa pessoal): nada é guardado, nem o evento bruto", async () => {
    const n = numeroDeTeste();
    const r = await registrarEvento("PROSPECCAO", mensagem("messages.upsert", n.e164, "FORA-1", "Oi amor, chego às 19h"));
    expect(r.eventoId).toBeNull();
    expect(r.resultados).toEqual(["ignorado: número fora da base"]);
    expect(await prisma.conversa.count({ where: { numero: n.e164 } })).toBe(0);
    expect(await eventosCom("FORA-1")).toBe(0);
    // O que o Rômulo digita para um número pessoal também não entra.
    const minha = await registrarEvento("PROSPECCAO", mensagem("messages.upsert", n.e164, "FORA-2", "Tá bom", true));
    expect(minha.eventoId).toBeNull();
    expect(await eventosCom("FORA-2")).toBe(0);
  });

  it("grupo, status e contato sem telefone (lid) são ignorados sem guardar nada", async () => {
    const grupo = { event: "messages.upsert", data: { key: { remoteJid: "120363025246125486@g.us", fromMe: false, id: "GRP-1" }, message: { conversation: "x" } } };
    const status = { event: "messages.upsert", data: { key: { remoteJid: "status@broadcast", fromMe: false, id: "STS-1" }, message: { conversation: "x" } } };
    const lid = { event: "messages.upsert", data: { key: { remoteJid: "99887766554433@lid", fromMe: false, id: "LID-1" }, message: { conversation: "x" } } };
    for (const corpo of [grupo, status, lid]) expect((await registrarEvento("PROSPECCAO", corpo)).eventoId).toBeNull();
    for (const id of ["GRP-1", "STS-1", "LID-1"]) expect(await eventosCom(id)).toBe(0);
  });

  it("recibo de mensagem que não é nossa não é guardado", async () => {
    const r = await registrarEvento("PROSPECCAO", { event: "messages.update", data: { keyId: `NAO-NOSSA-${Date.now()}`, status: "READ" } });
    expect(r.eventoId).toBeNull();
  });

  it("mensagem digitada no celular para um contato da base entra como enviada pelo celular", async () => {
    const e = await empresa();
    try {
      await registrarEvento("PROSPECCAO", mensagem("messages.upsert", e.n.e164, "CEL-1", "Te mando o catálogo à tarde", true));
      const m = await prisma.mensagem.findFirstOrThrow({ where: { idExterno: "CEL-1" } });
      expect(m).toMatchObject({ direcao: "SAIDA", origem: "ROMULO_NO_CELULAR", status: "ENVIADA", texto: "Te mando o catálogo à tarde" });
    } finally {
      await e.limpar();
    }
  });

  it("eco (SEND_MESSAGE) da mensagem que o sistema enviou é reconhecido: não duplica", async () => {
    const e = await empresa("APROVADA");
    try {
      const conversa = await prisma.conversa.create({ data: { linha: "PROSPECCAO", numero: e.n.e164, clienteId: e.cliente.id, contatoId: e.contato.id, ultimaMensagemEm: new Date() } });
      const base = { conversaId: conversa.id, linha: "PROSPECCAO" as const, direcao: "SAIDA" as const, origem: "PLATAFORMA" as const, tipo: "TEXTO" as const, ocorridoEm: new Date(), tipoEnvio: "PRIMEIRO_CONTATO" as const, aprovadaPorId: e.aprovador.id };
      // Já com o id devolvido pela API: o eco cai na deduplicação.
      await prisma.mensagem.create({ data: { ...base, idExterno: "ECO-1", status: "ENVIADA", texto: "Olá, quem cuida da compra?" } });
      const r1 = await registrarEvento("PROSPECCAO", mensagem("SEND_MESSAGE", e.n.e164, "ECO-1", "Olá, quem cuida da compra?", true));
      expect(r1.resultados).toEqual(["duplicada"]);
      // Eco que chega antes da resposta da API (ainda ENVIANDO, sem id): é adotado.
      const enviando = await prisma.mensagem.create({ data: { ...base, status: "ENVIANDO", texto: "Segunda mensagem?" } });
      const r2 = await registrarEvento("PROSPECCAO", mensagem("send.message", e.n.e164, "ECO-2", "Segunda mensagem?", true));
      expect(r2.resultados).toEqual(["adotada"]);
      expect(await prisma.mensagem.findUniqueOrThrow({ where: { id: enviando.id } })).toMatchObject({ idExterno: "ECO-2", status: "ENVIADA" });
      expect(await prisma.mensagem.count({ where: { conversaId: conversa.id } })).toBe(2);
    } finally {
      await e.limpar();
    }
  });

  it("conversa que já existia (mesmo sem empresa) continua recebendo", async () => {
    const n = numeroDeTeste();
    const conversa = await prisma.conversa.create({ data: { linha: "PROSPECCAO", numero: n.e164, motivoSemVinculo: "numero_desconhecido", ultimaMensagemEm: new Date() } });
    try {
      const r = await registrarEvento("PROSPECCAO", mensagem("messages.upsert", n.e164, "VELHA-1", "Oi de novo"));
      expect(r.resultados).toEqual(["mensagem"]);
      expect(await prisma.mensagem.count({ where: { conversaId: conversa.id } })).toBe(1);
    } finally {
      const ev = await prisma.mensagem.findMany({ where: { conversaId: conversa.id }, select: { eventoId: true } });
      await prisma.mensagem.deleteMany({ where: { conversaId: conversa.id } });
      await prisma.conversa.delete({ where: { id: conversa.id } });
      await prisma.eventoWhatsapp.deleteMany({ where: { id: { in: ev.flatMap((x) => (x.eventoId ? [x.eventoId] : [])) } } });
    }
  });

  it("resposta de quem já conversa entra na linha do tempo e fica 'precisa de você' (uma vez por vez de falar)", async () => {
    const e = await empresa("CONVERSANDO");
    try {
      await registrarEvento("PROSPECCAO", mensagem("messages.upsert", e.n.e164, "RESP-1", "Pode mandar a tabela de preços?"));
      await registrarEvento("PROSPECCAO", mensagem("messages.upsert", e.n.e164, "RESP-2", "E o prazo de entrega também"));
      const interacoes = await prisma.interacao.findMany({ where: { clienteId: e.cliente.id } });
      expect(interacoes).toHaveLength(1);
      expect(interacoes[0]).toMatchObject({ canal: "WHATSAPP", origem: "AUTOMACAO", comQuem: "Ana" });
      expect(interacoes[0].resumo).toContain("Respondeu pelo WhatsApp");
      expect(interacoes[0].resumo).toContain("Pode mandar a tabela de preços?");
    } finally {
      await e.limpar();
    }
  });

  it("CONNECTION_UPDATE guarda o estado da conexão (sem precisar de número)", async () => {
    vi.stubEnv("INTEGRACOES_CHAVE", randomBytes(32).toString("hex"));
    const admin = await prisma.usuario.create({ data: { nome: "Admin Conexão", email: `conexao-${Date.now()}@teste.local`, perfil: "ADMIN" } });
    try {
      await salvarEvolution(admin, { url: "https://evo.exemplo.com", instancia: "prospeccao", apikey: "k-123456", envioAutomatico: false });
      const r = await registrarEvento("PROSPECCAO", { event: "connection.update", instance: "prospeccao", data: { instance: "prospeccao", state: "close", statusReason: 401 } });
      expect(r.resultados).toEqual(["conexao: close"]);
      expect((await prisma.integracao.findUniqueOrThrow({ where: { tipo: "EVOLUTION" } })).estadoConexao).toBe("close");
      if (r.eventoId) await prisma.eventoWhatsapp.delete({ where: { id: r.eventoId } });
    } finally {
      await prisma.integracao.deleteMany({});
      await prisma.eventoAuditoria.deleteMany({ where: { usuarioId: admin.id } });
      await prisma.usuario.delete({ where: { id: admin.id } });
    }
  });
});
