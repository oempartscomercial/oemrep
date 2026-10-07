import { describe, it, expect, vi, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";

const obterUsuarioLogadoMock = vi.fn();
vi.mock("@/lib/sessao", () => ({ obterUsuarioLogado: () => obterUsuarioLogadoMock() }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/whatsapp/despachar", () => ({
  despachar: async () => ({ status: "ENVIADA" }),
  lerLimites: async () => ({}),
}));

import { definirOrigemContato, marcarNaoContatar, prepararMensagem, reativarContato } from "../actions";

afterEach(() => {
  obterUsuarioLogadoMock.mockReset();
});

const SEM_PERMISSAO = "Você não tem permissão para acessar o CRM.";
const MENSAGEM_CANCELADA = "Contato pediu para não ser contatado.";

// DDD 94: espaço de números próprio deste arquivo (os outros testes usam 96 e 97).
const base = String(Date.now()).slice(-6);
let contadorNumeros = 0;
function numeroUnico() {
  contadorNumeros += 1;
  const local = `${String(contadorNumeros).padStart(2, "0")}${base}`; // 8 dígitos; com o 9 do celular, 9 no total
  return {
    digitado: `+55 94 9${local.slice(0, 4)} ${local.slice(4)}`,
    formatado: `(94) 9${local.slice(0, 4)}-${local.slice(4)}`,
    e164: `+55949${local}`,
  };
}

let contadorEmpresas = 0;
async function cenario() {
  contadorEmpresas += 1;
  const sufixo = `${base}${contadorEmpresas}`;
  const usuario = await prisma.usuario.create({
    data: { nome: "Analista Contato", email: `nao-contatar-${sufixo}@teste.local`, perfil: "ANALISTA" },
  });
  const empresa = await prisma.cliente.create({ data: { nomeFantasia: `Empresa Nao Contatar ${sufixo}`, situacao: "APROVADA" } });
  const numeros: string[] = [];
  const logar = (perfil: "ANALISTA" | "OPERADOR" = "ANALISTA") =>
    obterUsuarioLogadoMock.mockResolvedValue({ id: usuario.id, nome: usuario.nome, perfil, fabricasIds: [] });
  const limpar = async () => {
    await prisma.mensagem.deleteMany({ where: { conversa: { OR: [{ clienteId: empresa.id }, { numero: { in: numeros } }] } } });
    await prisma.conversa.deleteMany({ where: { OR: [{ clienteId: empresa.id }, { numero: { in: numeros } }] } });
    await prisma.interacao.deleteMany({ where: { clienteId: empresa.id } });
    await prisma.eventoAuditoria.deleteMany({ where: { usuarioId: usuario.id } });
    await prisma.contato.deleteMany({ where: { clienteId: empresa.id } });
    await prisma.cliente.delete({ where: { id: empresa.id } });
    await prisma.usuario.delete({ where: { id: usuario.id } });
  };
  return { usuario, empresa, numeros, logar, limpar };
}
type Cenario = Awaited<ReturnType<typeof cenario>>;

/** Contato de WhatsApp da empresa, com a conversa dele (a conversa aponta para o contato). */
async function contatoComConversa(c: Cenario, nome: string) {
  const n = numeroUnico();
  c.numeros.push(n.e164);
  const contato = await prisma.contato.create({
    data: { clienteId: c.empresa.id, nome, canal: "WHATSAPP", valor: n.formatado, fonte: "Site", origemContato: "PUBLICADO_PELA_EMPRESA" },
  });
  const conversa = await prisma.conversa.create({
    data: { linha: "PROSPECCAO", numero: n.e164, clienteId: c.empresa.id, contatoId: contato.id, ultimaMensagemEm: new Date() },
  });
  return { contato, conversa };
}

async function mensagem(conversaId: string, status: "RASCUNHO" | "APROVADA" | "ENVIADA") {
  return prisma.mensagem.create({
    data: {
      conversaId,
      linha: "PROSPECCAO",
      direcao: "SAIDA",
      origem: "PLATAFORMA",
      tipo: "TEXTO",
      texto: "Olá, tudo bem?",
      ocorridoEm: new Date(),
      status,
      tipoEnvio: "FOLLOW_UP",
    },
  });
}

describe("marcarNaoContatar — permissão", () => {
  it("exige sessão e recusa OPERADOR; nada muda", async () => {
    const c = await cenario();
    try {
      const { contato } = await contatoComConversa(c, "Ana");
      obterUsuarioLogadoMock.mockResolvedValue(null);
      expect((await marcarNaoContatar({ contatoId: contato.id })).erros).toEqual(["Sessão expirada. Faça login novamente."]);
      c.logar("OPERADOR");
      expect((await marcarNaoContatar({ contatoId: contato.id })).erros).toEqual([SEM_PERMISSAO]);
      expect((await prisma.contato.findUniqueOrThrow({ where: { id: contato.id } })).naoContatar).toBe(false);
      expect(await prisma.interacao.count({ where: { clienteId: c.empresa.id } })).toBe(0);
    } finally {
      await c.limpar();
    }
  });
});

describe("marcarNaoContatar", () => {
  it("contato inexistente devolve erro", async () => {
    const c = await cenario();
    try {
      c.logar();
      expect((await marcarNaoContatar({ contatoId: `inexistente-${base}` })).erros).toEqual(["Contato não encontrado."]);
    } finally {
      await c.limpar();
    }
  });

  it("marca só este contato, cancela os pendentes dele e não mexe no resto", async () => {
    const c = await cenario();
    try {
      c.logar();
      const ana = await contatoComConversa(c, "Ana");
      const bruno = await contatoComConversa(c, "Bruno");
      const rascunho = await mensagem(ana.conversa.id, "RASCUNHO");
      const aprovada = await mensagem(ana.conversa.id, "APROVADA");
      const enviada = await mensagem(ana.conversa.id, "ENVIADA");
      const rascunhoDoBruno = await mensagem(bruno.conversa.id, "RASCUNHO");

      expect((await marcarNaoContatar({ contatoId: ana.contato.id })).erros).toEqual([]);

      expect(await prisma.contato.findUniqueOrThrow({ where: { id: ana.contato.id } })).toMatchObject({ naoContatar: true });
      expect(await prisma.contato.findUniqueOrThrow({ where: { id: bruno.contato.id } })).toMatchObject({ naoContatar: false });
      expect(await prisma.cliente.findUniqueOrThrow({ where: { id: c.empresa.id } })).toMatchObject({ naoContatar: false });

      expect(await prisma.mensagem.findUniqueOrThrow({ where: { id: rascunho.id } })).toMatchObject({
        status: "CANCELADA",
        motivoBloqueio: MENSAGEM_CANCELADA,
      });
      expect(await prisma.mensagem.findUniqueOrThrow({ where: { id: aprovada.id } })).toMatchObject({
        status: "CANCELADA",
        motivoBloqueio: MENSAGEM_CANCELADA,
      });
      expect(await prisma.mensagem.findUniqueOrThrow({ where: { id: enviada.id } })).toMatchObject({ status: "ENVIADA", motivoBloqueio: null });
      expect(await prisma.mensagem.findUniqueOrThrow({ where: { id: rascunhoDoBruno.id } })).toMatchObject({ status: "RASCUNHO" });

      const interacoes = await prisma.interacao.findMany({ where: { clienteId: c.empresa.id } });
      expect(interacoes).toHaveLength(1);
      expect(interacoes[0]).toMatchObject({
        canal: "OUTRO",
        origem: "USUARIO",
        usuarioId: c.usuario.id,
        comQuem: "Ana",
        resumo: 'Analista Contato marcou "não contatar" para Ana.',
      });

      const eventos = await prisma.eventoAuditoria.findMany({ where: { entidade: "Contato", entidadeId: ana.contato.id } });
      expect(eventos).toEqual([
        expect.objectContaining({ campo: "naoContatar", valorAnterior: "false", valorNovo: "true", usuarioId: c.usuario.id }),
      ]);
    } finally {
      await c.limpar();
    }
  });

  it("com motivo, o motivo vai para a linha do tempo", async () => {
    const c = await cenario();
    try {
      c.logar();
      const ana = await contatoComConversa(c, "Ana");
      expect((await marcarNaoContatar({ contatoId: ana.contato.id, motivo: "  Pediu para parar  " })).erros).toEqual([]);
      const interacao = await prisma.interacao.findFirstOrThrow({ where: { clienteId: c.empresa.id } });
      expect(interacao.resumo).toBe('Analista Contato marcou "não contatar" para Ana. Motivo: Pediu para parar');
    } finally {
      await c.limpar();
    }
  });

  it("marcar duas vezes não duplica a interação nem a auditoria", async () => {
    const c = await cenario();
    try {
      c.logar();
      const ana = await contatoComConversa(c, "Ana");
      expect((await marcarNaoContatar({ contatoId: ana.contato.id })).erros).toEqual([]);
      expect((await marcarNaoContatar({ contatoId: ana.contato.id })).erros).toEqual([]);
      expect(await prisma.interacao.count({ where: { clienteId: c.empresa.id } })).toBe(1);
      expect(await prisma.eventoAuditoria.count({ where: { entidade: "Contato", entidadeId: ana.contato.id } })).toBe(1);
    } finally {
      await c.limpar();
    }
  });

  it("se já estava marcado, cancela o que ficou pendente sem registrar de novo", async () => {
    const c = await cenario();
    try {
      c.logar();
      const ana = await contatoComConversa(c, "Ana");
      await prisma.contato.update({ where: { id: ana.contato.id }, data: { naoContatar: true } });
      const sobrou = await mensagem(ana.conversa.id, "RASCUNHO");

      expect((await marcarNaoContatar({ contatoId: ana.contato.id })).erros).toEqual([]);

      expect(await prisma.mensagem.findUniqueOrThrow({ where: { id: sobrou.id } })).toMatchObject({ status: "CANCELADA", motivoBloqueio: MENSAGEM_CANCELADA });
      expect(await prisma.interacao.count({ where: { clienteId: c.empresa.id } })).toBe(0);
      expect(await prisma.eventoAuditoria.count({ where: { entidade: "Contato", entidadeId: ana.contato.id } })).toBe(0);
    } finally {
      await c.limpar();
    }
  });
});

describe("reativarContato", () => {
  it("grava auditoria do contato (além da do cliente)", async () => {
    const c = await cenario();
    try {
      c.logar();
      const ana = await contatoComConversa(c, "Ana");
      await prisma.contato.update({ where: { id: ana.contato.id }, data: { naoContatar: true } });

      expect((await reativarContato({ contatoId: ana.contato.id })).erros).toEqual([]);

      expect(await prisma.contato.findUniqueOrThrow({ where: { id: ana.contato.id } })).toMatchObject({ naoContatar: false });
      const eventos = await prisma.eventoAuditoria.findMany({ where: { entidade: "Contato", entidadeId: ana.contato.id } });
      expect(eventos).toEqual([
        expect.objectContaining({ campo: "naoContatar", valorAnterior: "true", valorNovo: "false", usuarioId: c.usuario.id }),
      ]);
    } finally {
      await c.limpar();
    }
  });

  it("OPERADOR não reativa", async () => {
    const c = await cenario();
    try {
      const ana = await contatoComConversa(c, "Ana");
      await prisma.contato.update({ where: { id: ana.contato.id }, data: { naoContatar: true } });
      c.logar("OPERADOR");
      expect((await reativarContato({ contatoId: ana.contato.id })).erros).toEqual([SEM_PERMISSAO]);
      expect((await prisma.contato.findUniqueOrThrow({ where: { id: ana.contato.id } })).naoContatar).toBe(true);
    } finally {
      await c.limpar();
    }
  });
});

describe("definirOrigemContato", () => {
  it("grava auditoria com a origem anterior e a nova", async () => {
    const c = await cenario();
    try {
      c.logar();
      const n = numeroUnico();
      const contato = await prisma.contato.create({
        data: { clienteId: c.empresa.id, canal: "WHATSAPP", valor: n.formatado, fonte: "Lista" },
      });

      expect((await definirOrigemContato({ contatoId: contato.id, origem: "INDICACAO" })).erros).toEqual([]);
      expect((await definirOrigemContato({ contatoId: contato.id, origem: "BASE_PROFISSIONAL" })).erros).toEqual([]);

      expect((await prisma.contato.findUniqueOrThrow({ where: { id: contato.id } })).origemContato).toBe("BASE_PROFISSIONAL");
      const eventos = await prisma.eventoAuditoria.findMany({ where: { entidade: "Contato", entidadeId: contato.id, campo: "origemContato" } });
      expect(eventos).toHaveLength(2);
      expect(eventos).toContainEqual(expect.objectContaining({ valorAnterior: null, valorNovo: "INDICACAO", usuarioId: c.usuario.id }));
      expect(eventos).toContainEqual(expect.objectContaining({ valorAnterior: "INDICACAO", valorNovo: "BASE_PROFISSIONAL", usuarioId: c.usuario.id }));
    } finally {
      await c.limpar();
    }
  });
});

describe("prepararMensagem com contato marcado", () => {
  it("não cria rascunho para quem pediu para não ser contatado", async () => {
    const c = await cenario();
    try {
      c.logar();
      const { contato, conversa } = await contatoComConversa(c, "Ana");
      await prisma.contato.update({ where: { id: contato.id }, data: { naoContatar: true } });
      const r = await prepararMensagem({ contatoId: contato.id, texto: "Olá, tudo bem? Quem cuida da compra de eixos?" });
      expect(r.erros[0]).toMatch(/não ser contatado/);
      expect(await prisma.mensagem.count({ where: { conversaId: conversa.id } })).toBe(0);
    } finally {
      await c.limpar();
    }
  });
});
