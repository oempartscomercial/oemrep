import { describe, it, expect, vi, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";

const obterUsuarioLogadoMock = vi.fn();
vi.mock("@/lib/sessao", () => ({ obterUsuarioLogado: () => obterUsuarioLogadoMock() }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

import { concluirProximoPasso, moverEmpresa, registrarInteracao } from "../actions";

const amanha = () => new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
const ontem = () => new Date(Date.now() - 2 * 86_400_000).toISOString().slice(0, 10);

async function cenario(sufixo: string, situacao: "CANDIDATA" | "APROVADA" = "CANDIDATA") {
  const usuario = await prisma.usuario.create({
    data: { nome: "Analista CRM", email: `crm-${sufixo}@teste.local`, perfil: "ANALISTA" },
  });
  const empresa = await prisma.cliente.create({ data: { nomeFantasia: `Empresa CRM ${sufixo}`, situacao } });
  const passo = { acao: "Ligar para o comprador", prazo: amanha(), responsavelId: usuario.id };
  const limpar = async () => {
    await prisma.eventoAuditoria.deleteMany({ where: { usuarioId: usuario.id } });
    await prisma.interacao.deleteMany({ where: { clienteId: empresa.id } });
    await prisma.proximoPasso.deleteMany({ where: { clienteId: empresa.id } });
    await prisma.cliente.delete({ where: { id: empresa.id } });
    await prisma.usuario.delete({ where: { id: usuario.id } });
  };
  const logar = (perfil: "ANALISTA" | "OPERADOR" = "ANALISTA") =>
    obterUsuarioLogadoMock.mockResolvedValue({ id: usuario.id, nome: usuario.nome, perfil, fabricasIds: [] });
  return { usuario, empresa, passo, limpar, logar };
}

afterEach(() => obterUsuarioLogadoMock.mockReset());

describe("CRM — permissão", () => {
  it("exige sessão e recusa OPERADOR", async () => {
    const c = await cenario("p1");
    try {
      obterUsuarioLogadoMock.mockResolvedValue(null);
      expect((await moverEmpresa({ clienteId: c.empresa.id, para: "APROVADA", proximoPasso: c.passo })).erros).toEqual([
        "Sessão expirada. Faça login novamente.",
      ]);
      c.logar("OPERADOR");
      expect((await moverEmpresa({ clienteId: c.empresa.id, para: "APROVADA", proximoPasso: c.passo })).erros).toEqual([
        "Você não tem permissão para acessar o CRM.",
      ]);
      expect((await prisma.cliente.findUniqueOrThrow({ where: { id: c.empresa.id } })).situacao).toBe("CANDIDATA");
    } finally {
      await c.limpar();
    }
  }, 15000);
});

describe("moverEmpresa", () => {
  it("move para etapa ativa com próximo passo, registra na linha do tempo e audita", async () => {
    const c = await cenario("m1");
    try {
      c.logar();
      expect((await moverEmpresa({ clienteId: c.empresa.id, para: "APROVADA", proximoPasso: c.passo })).erros).toEqual([]);

      expect((await prisma.cliente.findUniqueOrThrow({ where: { id: c.empresa.id } })).situacao).toBe("APROVADA");
      const abertos = await prisma.proximoPasso.findMany({ where: { clienteId: c.empresa.id, concluidoEm: null } });
      expect(abertos.map((p) => p.acao)).toEqual(["Ligar para o comprador"]);
      const inter = await prisma.interacao.findMany({ where: { clienteId: c.empresa.id } });
      expect(inter.map((i) => i.resumo)).toEqual(["Etapa: A avaliar → Aprovada."]);
      const aud = await prisma.eventoAuditoria.findMany({ where: { entidade: "Cliente", entidadeId: c.empresa.id } });
      expect(aud.map((e) => [e.campo, e.valorAnterior, e.valorNovo])).toEqual([["situacao", "CANDIDATA", "APROVADA"]]);
    } finally {
      await c.limpar();
    }
  }, 15000);

  it("recusa etapa ativa sem próximo passo e data no passado, sem gravar nada", async () => {
    const c = await cenario("m2");
    try {
      c.logar();
      expect((await moverEmpresa({ clienteId: c.empresa.id, para: "APROVADA" })).erros.length).toBeGreaterThan(0);
      expect(
        (await moverEmpresa({ clienteId: c.empresa.id, para: "APROVADA", proximoPasso: { ...c.passo, prazo: ontem() } })).erros,
      ).toEqual(["Próximo passo: a data não pode estar no passado."]);
      expect((await prisma.cliente.findUniqueOrThrow({ where: { id: c.empresa.id } })).situacao).toBe("CANDIDATA");
      expect(await prisma.interacao.count({ where: { clienteId: c.empresa.id } })).toBe(0);
    } finally {
      await c.limpar();
    }
  }, 15000);

  it("descartar fecha os passos abertos e pode marcar não contatar", async () => {
    const c = await cenario("m3", "APROVADA");
    try {
      c.logar();
      await prisma.proximoPasso.create({
        data: { clienteId: c.empresa.id, acao: "Ligar", prazo: new Date(`${amanha()}T00:00:00Z`), responsavelId: c.usuario.id },
      });
      const r = await moverEmpresa({ clienteId: c.empresa.id, para: "DESCARTADA", motivo: "Pediu para sair", naoContatar: true });

      expect(r.erros).toEqual([]);
      const empresa = await prisma.cliente.findUniqueOrThrow({ where: { id: c.empresa.id } });
      expect([empresa.situacao, empresa.naoContatar]).toEqual(["DESCARTADA", true]);
      expect(await prisma.proximoPasso.count({ where: { clienteId: c.empresa.id, concluidoEm: null } })).toBe(0);
    } finally {
      await c.limpar();
    }
  }, 15000);

  it("cliente não volta para o funil", async () => {
    const c = await cenario("m4");
    try {
      c.logar();
      await prisma.cliente.update({ where: { id: c.empresa.id }, data: { situacao: "CLIENTE" } });
      expect((await moverEmpresa({ clienteId: c.empresa.id, para: "CANDIDATA" })).erros).toEqual([
        "Cliente não volta para o funil de prospecção.",
      ]);
    } finally {
      await c.limpar();
    }
  }, 15000);
});

describe("registrarInteracao e concluirProximoPasso", () => {
  it("empresa em andamento sem passo aberto exige o próximo passo", async () => {
    const c = await cenario("i1", "APROVADA");
    try {
      c.logar();
      const base = { clienteId: c.empresa.id, canal: "TELEFONE", resumo: "Falei com a Ana" };
      expect((await registrarInteracao(base)).erros).toEqual(["Diga qual é o próximo passo."]);
      expect(await prisma.interacao.count({ where: { clienteId: c.empresa.id } })).toBe(0);

      expect((await registrarInteracao({ ...base, proximoPasso: c.passo })).erros).toEqual([]);
      expect(await prisma.interacao.count({ where: { clienteId: c.empresa.id } })).toBe(1);
      expect(await prisma.proximoPasso.count({ where: { clienteId: c.empresa.id, concluidoEm: null } })).toBe(1);
    } finally {
      await c.limpar();
    }
  }, 15000);

  it("novo passo substitui o aberto, e concluir em andamento exige o seguinte", async () => {
    const c = await cenario("i2", "APROVADA");
    try {
      c.logar();
      await registrarInteracao({ clienteId: c.empresa.id, canal: "WHATSAPP", resumo: "Mandei mensagem", proximoPasso: c.passo });
      await registrarInteracao({
        clienteId: c.empresa.id, canal: "WHATSAPP", resumo: "Ela respondeu",
        proximoPasso: { ...c.passo, acao: "Enviar catálogo" },
      });
      const abertos = await prisma.proximoPasso.findMany({ where: { clienteId: c.empresa.id, concluidoEm: null } });
      expect(abertos.map((p) => p.acao)).toEqual(["Enviar catálogo"]);

      expect((await concluirProximoPasso({ id: abertos[0].id })).erros).toEqual(["Diga qual é o próximo passo."]);
      expect((await concluirProximoPasso({ id: abertos[0].id, proximo: { ...c.passo, acao: "Cobrar retorno" } })).erros).toEqual([]);
      const agora = await prisma.proximoPasso.findMany({ where: { clienteId: c.empresa.id, concluidoEm: null } });
      expect(agora.map((p) => p.acao)).toEqual(["Cobrar retorno"]);
    } finally {
      await c.limpar();
    }
  }, 15000);
});
