import { describe, it, expect, vi, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";

const obterUsuarioLogadoMock = vi.fn();
vi.mock("@/lib/sessao", () => ({ obterUsuarioLogado: () => obterUsuarioLogadoMock() }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
const despacharMock = vi.fn(async () => ({ status: "ENVIADA" as const }));
vi.mock("@/lib/whatsapp/despachar", () => ({ despachar: (...a: unknown[]) => (despacharMock as (...x: unknown[]) => unknown)(...a) }));

import { aprovarMensagem, cancelarMensagem, definirOrigemContato, editarRascunho, prepararMensagem, reativarContato, tentarEnviar } from "../actions";

afterEach(() => {
  obterUsuarioLogadoMock.mockReset();
  despacharMock.mockClear();
});

let contador = 0;
const BOM = "Olá, tudo bem? Sou o Rômulo, da OEM Rep. Representamos a Rudolph, fábrica de peças de transmissão para tratores. Vi que vocês trabalham com eixos cardan. Quem cuida da compra dessa linha aí? Gostaria de apresentar nosso catálogo.";

// DDD 96: espaço de números próprio deste arquivo.
async function cenario(valor?: string) {
  contador += 1;
  const sufixo = String(Date.now() + contador).slice(-6);
  const usuario = await prisma.usuario.create({ data: { nome: "Analista WA", email: `acao-${sufixo}@teste.local`, perfil: "ANALISTA" } });
  const empresa = await prisma.cliente.create({ data: { nomeFantasia: `Empresa Ação ${sufixo}`, situacao: "APROVADA" } });
  const contato = await prisma.contato.create({
    data: { clienteId: empresa.id, nome: "Ana", canal: "WHATSAPP", valor: valor ?? `(96) 9 97${sufixo.slice(0, 2)}-${sufixo.slice(2)}`, fonte: "Site" },
  });
  const logar = (perfil: "ANALISTA" | "OPERADOR" = "ANALISTA") =>
    obterUsuarioLogadoMock.mockResolvedValue({ id: usuario.id, nome: usuario.nome, perfil, fabricasIds: [] });
  const limpar = async () => {
    const conversas = await prisma.conversa.findMany({ where: { clienteId: empresa.id }, select: { id: true } });
    await prisma.mensagem.deleteMany({ where: { conversaId: { in: conversas.map((c) => c.id) } } });
    await prisma.conversa.deleteMany({ where: { clienteId: empresa.id } });
    await prisma.interacao.deleteMany({ where: { clienteId: empresa.id } });
    await prisma.eventoAuditoria.deleteMany({ where: { usuarioId: usuario.id } });
    await prisma.contato.deleteMany({ where: { clienteId: empresa.id } });
    await prisma.cliente.delete({ where: { id: empresa.id } });
    await prisma.usuario.delete({ where: { id: usuario.id } });
  };
  return { usuario, empresa, contato, logar, limpar };
}

describe("WhatsApp — permissão", () => {
  it("exige sessão e recusa OPERADOR", async () => {
    const c = await cenario();
    try {
      obterUsuarioLogadoMock.mockResolvedValue(null);
      expect((await prepararMensagem({ contatoId: c.contato.id, texto: BOM })).erros).toEqual(["Sessão expirada. Faça login novamente."]);
      c.logar("OPERADOR");
      expect((await prepararMensagem({ contatoId: c.contato.id, texto: BOM })).erros).toEqual(["Você não tem permissão para acessar o CRM."]);
      expect((await aprovarMensagem({ id: "x" })).erros).toEqual(["Você não tem permissão para acessar o CRM."]);
    } finally {
      await c.limpar();
    }
  });
});

describe("prepararMensagem", () => {
  it("cria a conversa e o rascunho como primeiro contato, sem enviar nada", async () => {
    const c = await cenario();
    try {
      c.logar();
      const r = await prepararMensagem({ contatoId: c.contato.id, texto: BOM });
      expect(r.erros).toEqual([]);
      const m = await prisma.mensagem.findUniqueOrThrow({ where: { id: r.id! }, include: { conversa: true } });
      expect(m).toMatchObject({ status: "RASCUNHO", tipoEnvio: "PRIMEIRO_CONTATO", direcao: "SAIDA", origem: "PLATAFORMA", criadaPorId: c.usuario.id, geradaPorIa: false });
      expect(m.conversa).toMatchObject({ clienteId: c.empresa.id, contatoId: c.contato.id, linha: "PROSPECCAO" });
      expect(despacharMock).not.toHaveBeenCalled();
    } finally {
      await c.limpar();
    }
  });

  it("não aceita texto fora das regras (primeira mensagem com link, espaço por preencher)", async () => {
    const c = await cenario();
    try {
      c.logar();
      expect((await prepararMensagem({ contatoId: c.contato.id, texto: BOM + " https://x.com.br" })).erros[0]).toContain("não leva link");
      expect((await prepararMensagem({ contatoId: c.contato.id, texto: BOM.replace("eixos cardan", "[peça]") })).erros).toContain("Preencha o que está entre colchetes antes de aprovar.");
      expect(await prisma.mensagem.count({ where: { conversa: { clienteId: c.empresa.id } } })).toBe(0);
    } finally {
      await c.limpar();
    }
  });

  it("contato com valor que não é telefone não vira conversa", async () => {
    const c = await cenario("contato@empresa.com.br");
    try {
      c.logar();
      expect((await prepararMensagem({ contatoId: c.contato.id, texto: BOM })).erros).toEqual(["O número deste contato não é um telefone válido."]);
    } finally {
      await c.limpar();
    }
  });

  it("só um pendente por conversa", async () => {
    const c = await cenario();
    try {
      c.logar();
      await prepararMensagem({ contatoId: c.contato.id, texto: BOM });
      expect((await prepararMensagem({ contatoId: c.contato.id, texto: BOM })).erros).toEqual(["Já existe uma mensagem pendente para este contato. Edite ou cancele a anterior."]);
    } finally {
      await c.limpar();
    }
  });

  it("número já ligado a outra empresa não é reaproveitado", async () => {
    const a = await cenario();
    const b = await cenario(a.contato.valor);
    try {
      a.logar();
      await prepararMensagem({ contatoId: a.contato.id, texto: BOM });
      b.logar();
      expect((await prepararMensagem({ contatoId: b.contato.id, texto: BOM })).erros).toEqual(["Este número já está ligado a outra empresa."]);
    } finally {
      await a.limpar();
      await b.limpar();
    }
  });
});

describe("editar, aprovar e cancelar", () => {
  it("edita só rascunho e revalida o texto", async () => {
    const c = await cenario();
    try {
      c.logar();
      const { id } = await prepararMensagem({ contatoId: c.contato.id, texto: BOM });
      expect((await editarRascunho({ id: id!, texto: "Sem pergunta nenhuma." })).erros[0]).toContain("precisa de uma pergunta");
      expect((await editarRascunho({ id: id!, texto: BOM.replace("eixos cardan", "engrenagens") })).erros).toEqual([]);
      expect((await prisma.mensagem.findUniqueOrThrow({ where: { id: id! } })).texto).toContain("engrenagens");
    } finally {
      await c.limpar();
    }
  });

  it("aprovar grava quem aprovou e quando, e só então chama o despacho", async () => {
    const c = await cenario();
    try {
      c.logar();
      const { id } = await prepararMensagem({ contatoId: c.contato.id, texto: BOM });
      const r = await aprovarMensagem({ id: id! });
      expect(r).toMatchObject({ erros: [], status: "ENVIADA" });
      const m = await prisma.mensagem.findUniqueOrThrow({ where: { id: id! } });
      expect(m.aprovadaPorId).toBe(c.usuario.id);
      expect(m.aprovadaEm).not.toBeNull();
      expect(despacharMock).toHaveBeenCalledTimes(1);
      expect(despacharMock.mock.calls[0]).toEqual([id]);
    } finally {
      await c.limpar();
    }
  });

  it("não aprova o que não é rascunho", async () => {
    const c = await cenario();
    try {
      c.logar();
      const { id } = await prepararMensagem({ contatoId: c.contato.id, texto: BOM });
      await cancelarMensagem({ id: id! });
      expect((await aprovarMensagem({ id: id! })).erros).toEqual(["Só dá para aprovar um rascunho."]);
      expect(despacharMock).not.toHaveBeenCalled();
    } finally {
      await c.limpar();
    }
  });

  it("cancelar rascunho ou aprovada pendente; tentarEnviar só reenvia aprovada", async () => {
    const c = await cenario();
    try {
      c.logar();
      const { id } = await prepararMensagem({ contatoId: c.contato.id, texto: BOM });
      expect((await tentarEnviar({ id: id! })).erros).toEqual(["Esta mensagem não está aprovada."]);
      await prisma.mensagem.update({ where: { id: id! }, data: { status: "APROVADA", aprovadaPorId: c.usuario.id } });
      expect((await tentarEnviar({ id: id! })).erros).toEqual([]);
      expect(despacharMock).toHaveBeenCalledTimes(1);
      expect((await cancelarMensagem({ id: id! })).erros).toEqual([]);
      expect((await prisma.mensagem.findUniqueOrThrow({ where: { id: id! } })).status).toBe("CANCELADA");
      expect((await cancelarMensagem({ id: id! })).erros).toEqual(["Só dá para cancelar uma mensagem que ainda não foi enviada."]);
    } finally {
      await c.limpar();
    }
  });
});

describe("contato: origem e reativação", () => {
  it("define a origem do número", async () => {
    const c = await cenario();
    try {
      c.logar();
      expect((await definirOrigemContato({ contatoId: c.contato.id, origem: "INVENTADA" })).erros).toEqual(["Escolha de onde veio o número."]);
      expect((await definirOrigemContato({ contatoId: c.contato.id, origem: "PUBLICADO_PELA_EMPRESA" })).erros).toEqual([]);
      expect((await prisma.contato.findUniqueOrThrow({ where: { id: c.contato.id } })).origemContato).toBe("PUBLICADO_PELA_EMPRESA");
    } finally {
      await c.limpar();
    }
  });

  it("reativar desfaz o 'não contatar' do contato e da empresa e deixa rastro", async () => {
    const c = await cenario();
    try {
      c.logar();
      await prisma.contato.update({ where: { id: c.contato.id }, data: { naoContatar: true } });
      await prisma.cliente.update({ where: { id: c.empresa.id }, data: { naoContatar: true } });
      expect((await reativarContato({ contatoId: c.contato.id })).erros).toEqual([]);
      expect((await prisma.contato.findUniqueOrThrow({ where: { id: c.contato.id } })).naoContatar).toBe(false);
      expect((await prisma.cliente.findUniqueOrThrow({ where: { id: c.empresa.id } })).naoContatar).toBe(false);
      const i = await prisma.interacao.findFirstOrThrow({ where: { clienteId: c.empresa.id } });
      expect(i).toMatchObject({ origem: "USUARIO", usuarioId: c.usuario.id });
      expect(i.resumo).toContain("não contatar");
    } finally {
      await c.limpar();
    }
  });
});
