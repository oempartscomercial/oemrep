import { describe, it, expect, vi, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";

const obterUsuarioLogadoMock = vi.fn();
vi.mock("@/lib/sessao", () => ({ obterUsuarioLogado: () => obterUsuarioLogadoMock() }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

import { criarOportunidade, moverOportunidade } from "../actions";
import { registrarInteracao, concluirProximoPasso, moverEmpresa } from "../../empresas/actions";
import { registrarEfeitosDoPedido } from "@/lib/pedido-lancado";

const amanha = () => new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

async function cenario(s: string) {
  const usuario = await prisma.usuario.create({ data: { nome: "Analista Carteira", email: `cart-${s}@teste.local`, perfil: "ANALISTA" } });
  const bowden = await prisma.fabrica.create({ data: { nome: `Bowden ${s}`, cnpj: `85000000${s}0001` } });
  const corven = await prisma.fabrica.create({ data: { nome: `Corven ${s}`, cnpj: `85000000${s}0002` } });
  const cliente = await prisma.cliente.create({
    data: { nomeFantasia: `Cliente Carteira ${s}`, situacao: "CLIENTE", fabricas: { create: [{ fabricaId: bowden.id }] } },
  });
  const passo = { acao: "Mandar a tabela", prazo: amanha(), responsavelId: usuario.id };
  const limpar = async () => {
    await prisma.eventoAuditoria.deleteMany({ where: { usuarioId: usuario.id } });
    await prisma.interacao.deleteMany({ where: { clienteId: cliente.id } });
    await prisma.proximoPasso.deleteMany({ where: { clienteId: cliente.id } });
    await prisma.oportunidade.deleteMany({ where: { clienteId: cliente.id } });
    await prisma.pedido.deleteMany({ where: { clienteId: cliente.id } });
    await prisma.clienteFabrica.deleteMany({ where: { clienteId: cliente.id } });
    await prisma.cliente.delete({ where: { id: cliente.id } });
    await prisma.usuario.delete({ where: { id: usuario.id } });
    await prisma.fabrica.deleteMany({ where: { id: { in: [bowden.id, corven.id] } } });
  };
  const logar = (perfil: "ANALISTA" | "OPERADOR" = "ANALISTA") =>
    obterUsuarioLogadoMock.mockResolvedValue({ id: usuario.id, nome: usuario.nome, perfil, fabricasIds: [] });
  return { usuario, bowden, corven, cliente, passo, limpar, logar };
}

afterEach(() => obterUsuarioLogadoMock.mockReset());

describe("criarOportunidade", () => {
  it("cria para fábrica que o cliente ainda não compra e registra na linha do tempo", async () => {
    const c = await cenario("01");
    try {
      c.logar();
      expect((await criarOportunidade({ clienteId: c.cliente.id, fabricaId: c.corven.id, tipo: "VENDER_FABRICA_NOVA" })).erros).toEqual([]);
      const o = await prisma.oportunidade.findFirstOrThrow({ where: { clienteId: c.cliente.id } });
      expect([o.etapa, o.tipo]).toEqual(["A_ABORDAR", "VENDER_FABRICA_NOVA"]);
      const inter = await prisma.interacao.findMany({ where: { oportunidadeId: o.id } });
      expect(inter[0].resumo).toContain(`Corven 01`);
    } finally {
      await c.limpar();
    }
  }, 15000);

  it("recusa tipo incoerente, duplicata aberta, prospecção e operador", async () => {
    const c = await cenario("02");
    try {
      c.logar();
      expect((await criarOportunidade({ clienteId: c.cliente.id, fabricaId: c.bowden.id, tipo: "VENDER_FABRICA_NOVA" })).erros[0]).toContain("já compra");
      expect((await criarOportunidade({ clienteId: c.cliente.id, fabricaId: c.corven.id, tipo: "REATIVAR" })).erros[0]).toContain("nunca comprou");
      expect((await criarOportunidade({ clienteId: c.cliente.id, fabricaId: c.bowden.id, tipo: "REATIVAR" })).erros).toEqual([]);
      expect((await criarOportunidade({ clienteId: c.cliente.id, fabricaId: c.bowden.id, tipo: "REATIVAR" })).erros[0]).toContain("Já existe uma oportunidade aberta");

      await prisma.cliente.update({ where: { id: c.cliente.id }, data: { situacao: "CANDIDATA" } });
      expect((await criarOportunidade({ clienteId: c.cliente.id, fabricaId: c.corven.id, tipo: "VENDER_FABRICA_NOVA" })).erros[0]).toContain("só de clientes");

      c.logar("OPERADOR");
      expect((await criarOportunidade({ clienteId: c.cliente.id, fabricaId: c.corven.id, tipo: "VENDER_FABRICA_NOVA" })).erros).toEqual([
        "Você não tem permissão para acessar o CRM.",
      ]);
    } finally {
      await c.limpar();
    }
  }, 15000);
});

describe("moverOportunidade", () => {
  it("andar de etapa exige próximo passo e os passos da empresa não são afetados", async () => {
    const c = await cenario("03");
    try {
      c.logar();
      await criarOportunidade({ clienteId: c.cliente.id, fabricaId: c.corven.id, tipo: "VENDER_FABRICA_NOVA" });
      const o = await prisma.oportunidade.findFirstOrThrow({ where: { clienteId: c.cliente.id } });
      // passo da empresa, independente da oportunidade
      await registrarInteracao({ clienteId: c.cliente.id, canal: "TELEFONE", resumo: "Liguei", proximoPasso: { ...c.passo, acao: "Passo da empresa" } });

      expect((await moverOportunidade({ id: o.id, para: "ABORDADO" })).erros.length).toBeGreaterThan(0);
      expect((await moverOportunidade({ id: o.id, para: "ABORDADO", proximoPasso: c.passo })).erros).toEqual([]);
      expect((await moverOportunidade({ id: o.id, para: "COTACAO", proximoPasso: { ...c.passo, acao: "Cobrar resposta" } })).erros).toEqual([]);

      const passos = await prisma.proximoPasso.findMany({ where: { clienteId: c.cliente.id, concluidoEm: null }, orderBy: { acao: "asc" } });
      expect(passos.map((p) => [p.acao, p.oportunidadeId === o.id])).toEqual([["Cobrar resposta", true], ["Passo da empresa", false]]);
      const aud = await prisma.eventoAuditoria.findMany({ where: { entidade: "Oportunidade", entidadeId: o.id }, orderBy: { criadoEm: "asc" } });
      expect(aud.map((e) => e.valorNovo)).toEqual(["A_ABORDAR", "ABORDADO", "COTACAO"]);
    } finally {
      await c.limpar();
    }
  }, 20000);

  it("perdida guarda o motivo, pode reabrir; ganha não é manual", async () => {
    const c = await cenario("04");
    try {
      c.logar();
      await criarOportunidade({ clienteId: c.cliente.id, fabricaId: c.corven.id, tipo: "VENDER_FABRICA_NOVA" });
      const o = await prisma.oportunidade.findFirstOrThrow({ where: { clienteId: c.cliente.id } });

      expect((await moverOportunidade({ id: o.id, para: "GANHA" })).erros[0]).toContain("fica ganha sozinha");
      expect((await moverOportunidade({ id: o.id, para: "PERDIDA", motivo: "Já tem fornecedor" })).erros).toEqual([]);
      const perdida = await prisma.oportunidade.findUniqueOrThrow({ where: { id: o.id } });
      expect([perdida.etapa, perdida.motivoPerda, perdida.encerradaEm !== null]).toEqual(["PERDIDA", "Já tem fornecedor", true]);

      expect((await moverOportunidade({ id: o.id, para: "A_ABORDAR" })).erros).toEqual([]);
      const reaberta = await prisma.oportunidade.findUniqueOrThrow({ where: { id: o.id } });
      expect([reaberta.etapa, reaberta.motivoPerda, reaberta.encerradaEm]).toEqual(["A_ABORDAR", null, null]);
    } finally {
      await c.limpar();
    }
  }, 15000);

  it("registrar contato e concluir passo respeitam a oportunidade em andamento", async () => {
    const c = await cenario("05");
    try {
      c.logar();
      await criarOportunidade({ clienteId: c.cliente.id, fabricaId: c.corven.id, tipo: "VENDER_FABRICA_NOVA" });
      const o = await prisma.oportunidade.findFirstOrThrow({ where: { clienteId: c.cliente.id } });
      await moverOportunidade({ id: o.id, para: "ABORDADO", proximoPasso: c.passo });
      const passo = await prisma.proximoPasso.findFirstOrThrow({ where: { oportunidadeId: o.id, concluidoEm: null } });

      expect((await concluirProximoPasso({ id: passo.id })).erros).toEqual(["Diga qual é o próximo passo."]);
      expect((await concluirProximoPasso({ id: passo.id, proximo: { ...c.passo, acao: "Ligar de novo" } })).erros).toEqual([]);
      const aberto = await prisma.proximoPasso.findMany({ where: { oportunidadeId: o.id, concluidoEm: null } });
      expect(aberto.map((p) => p.acao)).toEqual(["Ligar de novo"]);

      expect((await registrarInteracao({ clienteId: c.cliente.id, canal: "WHATSAPP", resumo: "Respondeu", oportunidadeId: o.id, proximoPasso: { ...c.passo, acao: "Enviar catálogo" } })).erros).toEqual([]);
      expect((await prisma.proximoPasso.findMany({ where: { oportunidadeId: o.id, concluidoEm: null } })).map((p) => p.acao)).toEqual(["Enviar catálogo"]);
      expect(await prisma.interacao.count({ where: { oportunidadeId: o.id, canal: "WHATSAPP" } })).toBe(1);
    } finally {
      await c.limpar();
    }
  }, 20000);
});

describe("ganho automático (pedido lançado)", () => {
  it("pedido do cliente na fábrica da oportunidade a deixa ganha e encerra os passos dela", async () => {
    const c = await cenario("06");
    try {
      c.logar();
      await criarOportunidade({ clienteId: c.cliente.id, fabricaId: c.corven.id, tipo: "VENDER_FABRICA_NOVA" });
      await criarOportunidade({ clienteId: c.cliente.id, fabricaId: c.bowden.id, tipo: "REATIVAR" });
      const oCorven = await prisma.oportunidade.findFirstOrThrow({ where: { clienteId: c.cliente.id, fabricaId: c.corven.id } });
      await moverOportunidade({ id: oCorven.id, para: "ABORDADO", proximoPasso: c.passo });

      await prisma.$transaction((tx) => registrarEfeitosDoPedido(tx, { numero: "PED-CART-1", clienteId: c.cliente.id, fabricaId: c.corven.id }));

      const ganha = await prisma.oportunidade.findUniqueOrThrow({ where: { id: oCorven.id } });
      expect([ganha.etapa, ganha.encerradaEm !== null]).toEqual(["GANHA", true]);
      expect(await prisma.proximoPasso.count({ where: { oportunidadeId: oCorven.id, concluidoEm: null } })).toBe(0);
      const auto = await prisma.interacao.findFirstOrThrow({ where: { oportunidadeId: oCorven.id, origem: "AUTOMACAO" } });
      expect(auto.resumo).toContain("oportunidade ganha");
      // a outra oportunidade (outra fábrica) segue aberta
      expect((await prisma.oportunidade.findFirstOrThrow({ where: { clienteId: c.cliente.id, fabricaId: c.bowden.id } })).etapa).toBe("A_ABORDAR");
    } finally {
      await c.limpar();
    }
  }, 20000);

  it("mover a empresa de prospecção não encerra os passos das oportunidades", async () => {
    const c = await cenario("07");
    try {
      c.logar();
      await criarOportunidade({ clienteId: c.cliente.id, fabricaId: c.corven.id, tipo: "VENDER_FABRICA_NOVA" });
      const o = await prisma.oportunidade.findFirstOrThrow({ where: { clienteId: c.cliente.id } });
      await moverOportunidade({ id: o.id, para: "ABORDADO", proximoPasso: c.passo });
      await prisma.cliente.update({ where: { id: c.cliente.id }, data: { situacao: "APROVADA" } });

      expect((await moverEmpresa({ clienteId: c.cliente.id, para: "DESCARTADA", motivo: "Teste" })).erros).toEqual([]);
      expect(await prisma.proximoPasso.count({ where: { oportunidadeId: o.id, concluidoEm: null } })).toBe(1);
    } finally {
      await c.limpar();
    }
  }, 20000);
});
