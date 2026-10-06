import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import { registrarEvento } from "../registrar";

let contador = 0;
// DDD 98: espaço de números próprio, para não colidir com os outros arquivos de teste que
// rodam em paralelo no mesmo banco (registrar.test.ts usa o DDD 99).
function numeroDeTeste() {
  contador += 1;
  const sufixo = String(Date.now() + contador).slice(-6);
  const final = `97${sufixo.slice(0, 2)}-${sufixo.slice(2)}`;
  return { cadastro: `(98) 9 ${final}`, e164: `+5598997${sufixo}` };
}
const jid = (e164: string) => `${e164.slice(1)}@s.whatsapp.net`;

const upsert = (e164: string, id: string, texto: string, extra: { fromMe?: boolean; ts?: number } = {}) => ({
  event: "messages.upsert",
  data: {
    key: { remoteJid: jid(e164), fromMe: extra.fromMe ?? false, id },
    pushName: "Contato",
    message: { conversation: texto },
    messageTimestamp: extra.ts ?? Math.floor(Date.now() / 1000),
  },
});
const recibo = (id: string, status: string) => ({ event: "messages.update", data: { keyId: id, status } });

async function cenario(situacao: "APROVADA" | "EM_CONTATO" | "CONVERSANDO" | "CLIENTE" = "EM_CONTATO") {
  const n = numeroDeTeste();
  const aprovador = await prisma.usuario.create({ data: { nome: "Aprovador WA", email: `wa-${n.e164.slice(-8)}@teste.local`, perfil: "ANALISTA" } });
  const empresa = await prisma.cliente.create({ data: { nomeFantasia: `Empresa Entrada ${n.e164.slice(-6)}`, situacao } });
  const contato = await prisma.contato.create({
    data: { clienteId: empresa.id, nome: "Ana", canal: "WHATSAPP", valor: n.cadastro, fonte: "Site", origemContato: "PUBLICADO_PELA_EMPRESA" },
  });
  // O número já foi abordado: existe uma conversa com uma mensagem nossa aprovada pelo analista.
  const conversa = await prisma.conversa.create({
    data: { linha: "PROSPECCAO", numero: n.e164, clienteId: empresa.id, contatoId: contato.id, ultimaMensagemEm: new Date() },
  });
  const nossa = (id: string, extra: Record<string, unknown> = {}) =>
    prisma.mensagem.create({
      data: {
        conversaId: conversa.id, linha: "PROSPECCAO", direcao: "SAIDA", origem: "PLATAFORMA", tipo: "TEXTO",
        ocorridoEm: new Date(Date.now() - 3 * 86_400_000), idExterno: id, status: "ENVIADA", texto: "Olá, quem cuida da compra?",
        tipoEnvio: "PRIMEIRO_CONTATO", aprovadaPorId: aprovador.id, ...extra,
      },
    });
  const limpar = async () => {
    await prisma.mensagem.deleteMany({ where: { conversaId: conversa.id } });
    await prisma.conversa.deleteMany({ where: { numero: n.e164 } });
    await prisma.interacao.deleteMany({ where: { clienteId: empresa.id } });
    await prisma.proximoPasso.deleteMany({ where: { clienteId: empresa.id } });
    await prisma.contato.deleteMany({ where: { clienteId: empresa.id } });
    await prisma.cliente.delete({ where: { id: empresa.id } });
    await prisma.usuario.delete({ where: { id: aprovador.id } });
  };
  return { n, aprovador, empresa, contato, conversa, nossa, limpar };
}

const passosAbertos = (clienteId: string) => prisma.proximoPasso.findMany({ where: { clienteId, concluidoEm: null } });

describe("entrada — resposta de quem estava 'em contato'", () => {
  it("move para 'conversando', cria o passo 'Responder' para quem aprovou e cancela a cadência pendente", async () => {
    const c = await cenario("EM_CONTATO");
    try {
      await c.nossa("ENV-1");
      await prisma.proximoPasso.create({ data: { clienteId: c.empresa.id, acao: "Acompanhar resposta", prazo: new Date(), responsavelId: c.aprovador.id } });
      const followUp = await c.nossa("", { idExterno: null, status: "RASCUNHO", tipoEnvio: "FOLLOW_UP", texto: "Passando para saber", ocorridoEm: new Date() });
      const resposta = await c.nossa("", { idExterno: null, status: "RASCUNHO", tipoEnvio: "RESPOSTA", texto: "Segue o catálogo", ocorridoEm: new Date() });

      const r = await registrarEvento("PROSPECCAO", upsert(c.n.e164, "IN-1", "Bom dia, pode mandar o catálogo?"));
      expect(r.resultados).toEqual(["mensagem"]);

      expect((await prisma.cliente.findUniqueOrThrow({ where: { id: c.empresa.id } })).situacao).toBe("CONVERSANDO");
      const passos = await passosAbertos(c.empresa.id);
      expect(passos).toHaveLength(1);
      expect(passos[0]).toMatchObject({ acao: "Responder a Ana", responsavelId: c.aprovador.id, oportunidadeId: null });

      const interacao = await prisma.interacao.findFirstOrThrow({ where: { clienteId: c.empresa.id } });
      expect(interacao).toMatchObject({ origem: "AUTOMACAO", canal: "WHATSAPP" });
      expect(interacao.resumo).toContain("Em contato → Conversando (movido automaticamente)");

      expect((await prisma.mensagem.findUniqueOrThrow({ where: { id: followUp.id } })).status).toBe("CANCELADA");
      // Rascunho de resposta é do Rômulo, não da cadência: continua de pé.
      expect((await prisma.mensagem.findUniqueOrThrow({ where: { id: resposta.id } })).status).toBe("RASCUNHO");
    } finally {
      await c.limpar();
    }
  });

  it("reenvio do mesmo evento não repete os efeitos", async () => {
    const c = await cenario("EM_CONTATO");
    try {
      await c.nossa("ENV-2");
      const corpo = upsert(c.n.e164, "IN-2", "Quem fala?");
      await registrarEvento("PROSPECCAO", corpo);
      const r2 = await registrarEvento("PROSPECCAO", corpo);
      expect(r2.resultados).toEqual(["duplicada"]);
      expect(await prisma.interacao.count({ where: { clienteId: c.empresa.id } })).toBe(1);
      expect(await passosAbertos(c.empresa.id)).toHaveLength(1);
    } finally {
      await c.limpar();
    }
  });

  it("quem já conversa não muda de etapa nem ganha passo; só a cadência é cancelada", async () => {
    const c = await cenario("CONVERSANDO");
    try {
      await c.nossa("ENV-3");
      const followUp = await c.nossa("", { idExterno: null, status: "APROVADA", tipoEnvio: "FOLLOW_UP", texto: "Passando", ocorridoEm: new Date() });
      await registrarEvento("PROSPECCAO", upsert(c.n.e164, "IN-3", "Pode ser sexta"));
      expect((await prisma.cliente.findUniqueOrThrow({ where: { id: c.empresa.id } })).situacao).toBe("CONVERSANDO");
      expect(await passosAbertos(c.empresa.id)).toHaveLength(0);
      expect((await prisma.mensagem.findUniqueOrThrow({ where: { id: followUp.id } })).status).toBe("CANCELADA");
    } finally {
      await c.limpar();
    }
  });

  it("número sem empresa só grava a mensagem (nunca responde, nunca muda o CRM)", async () => {
    const n = numeroDeTeste();
    try {
      const r = await registrarEvento("PROSPECCAO", upsert(n.e164, "IN-4", "Quem fala?"));
      expect(r.resultados).toEqual(["mensagem"]);
      const m = await prisma.mensagem.findFirstOrThrow({ where: { idExterno: "IN-4" } });
      expect(m.status).toBe("RECEBIDA");
    } finally {
      await prisma.mensagem.deleteMany({ where: { idExterno: "IN-4" } });
      await prisma.conversa.deleteMany({ where: { numero: n.e164 } });
    }
  });
});

describe("entrada — pedido de parar (ADR-015 §5)", () => {
  it("marca contato e empresa, cancela tudo, registra na linha do tempo e não cria tarefa", async () => {
    const c = await cenario("EM_CONTATO");
    try {
      await c.nossa("ENV-5");
      const rascunhos = [
        await c.nossa("", { idExterno: null, status: "RASCUNHO", tipoEnvio: "FOLLOW_UP", texto: "a", ocorridoEm: new Date() }),
        await c.nossa("", { idExterno: null, status: "APROVADA", tipoEnvio: "RESPOSTA", texto: "b", ocorridoEm: new Date() }),
      ];
      await registrarEvento("PROSPECCAO", upsert(c.n.e164, "IN-5", "Pare de me mandar mensagem, por favor"));

      expect((await prisma.contato.findUniqueOrThrow({ where: { id: c.contato.id } })).naoContatar).toBe(true);
      const empresa = await prisma.cliente.findUniqueOrThrow({ where: { id: c.empresa.id } });
      expect(empresa).toMatchObject({ naoContatar: true, situacao: "EM_CONTATO" });
      for (const r of rascunhos) expect((await prisma.mensagem.findUniqueOrThrow({ where: { id: r.id } })).status).toBe("CANCELADA");
      expect(await passosAbertos(c.empresa.id)).toHaveLength(0);

      const m = await prisma.mensagem.findFirstOrThrow({ where: { idExterno: "IN-5" } });
      expect(m).toMatchObject({ classificacao: "NAO_CONTATAR", classificacaoOrigem: "REGRA" });
      const interacao = await prisma.interacao.findFirstOrThrow({ where: { clienteId: c.empresa.id } });
      expect(interacao.resumo).toContain("não contatar");
    } finally {
      await c.limpar();
    }
  });

  it("'não tenho interesse' não suprime nem move: pede para o Rômulo olhar", async () => {
    const c = await cenario("EM_CONTATO");
    try {
      await c.nossa("ENV-6");
      await registrarEvento("PROSPECCAO", upsert(c.n.e164, "IN-6", "Não tenho interesse, obrigado"));
      const empresa = await prisma.cliente.findUniqueOrThrow({ where: { id: c.empresa.id } });
      expect(empresa).toMatchObject({ naoContatar: false, situacao: "EM_CONTATO" });
      expect((await prisma.contato.findUniqueOrThrow({ where: { id: c.contato.id } })).naoContatar).toBe(false);
      const passos = await passosAbertos(c.empresa.id);
      expect(passos.map((p) => p.acao)).toEqual(["Ver resposta de Ana: disse que não tem interesse"]);
      expect((await prisma.mensagem.findFirstOrThrow({ where: { idExterno: "IN-6" } })).classificacao).toBe("NAO_INTERESSADO");
    } finally {
      await c.limpar();
    }
  });
});

describe("saída — recibos e eco da própria mensagem", () => {
  it("entregue e lida só avançam, nunca voltam", async () => {
    const c = await cenario("EM_CONTATO");
    try {
      await c.nossa("ENV-7");
      await registrarEvento("PROSPECCAO", recibo("ENV-7", "READ"));
      expect((await prisma.mensagem.findFirstOrThrow({ where: { idExterno: "ENV-7" } })).status).toBe("LIDA");
      const r = await registrarEvento("PROSPECCAO", recibo("ENV-7", "DELIVERY_ACK"));
      expect(r.resultados).toEqual(["status: sem mudança"]);
      expect((await prisma.mensagem.findFirstOrThrow({ where: { idExterno: "ENV-7" } })).status).toBe("LIDA");
      const sem = await registrarEvento("PROSPECCAO", recibo("NAO-EXISTE", "READ"));
      expect(sem.resultados).toEqual(["status: sem mudança"]);
    } finally {
      await c.limpar();
    }
  });

  it("o eco da mensagem que a plataforma acabou de enviar é adotado, não vira duplicata 'pelo celular'", async () => {
    const c = await cenario("EM_CONTATO");
    try {
      // Enviando: a API ainda não devolveu o id, mas o webhook com o eco chegou primeiro.
      const enviando = await c.nossa("", { idExterno: null, status: "ENVIANDO", texto: "Segue o catálogo", ocorridoEm: new Date(), tipoEnvio: "RESPOSTA" });
      const r = await registrarEvento("PROSPECCAO", upsert(c.n.e164, "ECO-1", "Segue o catálogo", { fromMe: true }));
      expect(r.resultados).toEqual(["adotada"]);
      const depois = await prisma.mensagem.findUniqueOrThrow({ where: { id: enviando.id } });
      expect(depois).toMatchObject({ idExterno: "ECO-1", status: "ENVIADA", origem: "PLATAFORMA" });
      expect(await prisma.mensagem.count({ where: { conversaId: c.conversa.id, idExterno: "ECO-1" } })).toBe(1);
    } finally {
      await c.limpar();
    }
  });

  it("mensagem digitada no celular continua entrando como ENVIADA do Rômulo", async () => {
    const c = await cenario("EM_CONTATO");
    try {
      await registrarEvento("PROSPECCAO", upsert(c.n.e164, "CEL-1", "Oi, é o Rômulo", { fromMe: true }));
      const m = await prisma.mensagem.findFirstOrThrow({ where: { idExterno: "CEL-1" } });
      expect(m).toMatchObject({ direcao: "SAIDA", origem: "ROMULO_NO_CELULAR", status: "ENVIADA" });
    } finally {
      await c.limpar();
    }
  });
});
