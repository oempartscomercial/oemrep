import { describe, it, expect, vi } from "vitest";
import { prisma } from "@/lib/prisma";

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const obterUsuarioLogadoMock = vi.fn();
vi.mock("@/lib/sessao", () => ({
  obterUsuarioLogado: () => obterUsuarioLogadoMock(),
}));

import { criarPedidoManual } from "../actions";

function montarFormData(fabricaId: string, clienteId: string): FormData {
  const formData = new FormData();
  formData.set("numero", "PED-AUTHZ-1");
  formData.set("fabricaId", fabricaId);
  formData.set("clienteId", clienteId);
  formData.append("referencia", "REF-1");
  formData.append("descricao", "Peça");
  formData.append("quantidade", "1");
  formData.append("valorUnitario", "10");
  return formData;
}

describe("criarPedidoManual — autorização por fábrica (ADR-009)", () => {
  it("recusa criar pedido em fábrica que o usuário não tem permissão", async () => {
    const fabrica = await prisma.fabrica.create({
      data: { nome: "Fábrica Sem Permissão", cnpj: "80000000000635" },
    });
    const cliente = await prisma.cliente.create({
      data: { cnpj: "80000000000716", nomeFantasia: "Cliente Sem Permissão" },
    });
    obterUsuarioLogadoMock.mockResolvedValue({
      id: "u1",
      nome: "Op",
      perfil: "OPERADOR",
      fabricasIds: ["outra-fabrica-qualquer"],
    });

    const resultado = await criarPedidoManual(montarFormData(fabrica.id, cliente.id));

    expect(resultado.erros).toEqual(["Você não tem permissão para criar pedidos nesta fábrica."]);
    const pedidosCriados = await prisma.pedido.findMany({ where: { fabricaId: fabrica.id } });
    expect(pedidosCriados).toHaveLength(0);

    await prisma.cliente.delete({ where: { id: cliente.id } });
    await prisma.fabrica.delete({ where: { id: fabrica.id } });
  }, 15000);

  it("permite criar pedido quando o usuário tem permissão na fábrica", async () => {
    const fabrica = await prisma.fabrica.create({
      data: { nome: "Fábrica Com Permissão", cnpj: "80000000000805" },
    });
    const cliente = await prisma.cliente.create({
      data: { cnpj: "80000000000988", nomeFantasia: "Cliente Com Permissão" },
    });
    const usuario = await prisma.usuario.create({
      data: { nome: "Op", email: "op-authz-2@example.com", perfil: "OPERADOR" },
    });
    obterUsuarioLogadoMock.mockResolvedValue({
      id: usuario.id,
      nome: "Op",
      perfil: "OPERADOR",
      fabricasIds: [fabrica.id],
    });

    const resultado = await criarPedidoManual(montarFormData(fabrica.id, cliente.id));

    expect(resultado.erros).toEqual([]);
    const pedidosCriados = await prisma.pedido.findMany({ where: { fabricaId: fabrica.id } });
    expect(pedidosCriados).toHaveLength(1);

    await prisma.eventoAuditoria.deleteMany({ where: { entidadeId: pedidosCriados[0].id } });
    await prisma.itemPedido.deleteMany({ where: { pedidoId: pedidosCriados[0].id } });
    await prisma.pedido.delete({ where: { id: pedidosCriados[0].id } });
    await prisma.usuario.delete({ where: { id: usuario.id } });
    await prisma.clienteFabrica.deleteMany({ where: { clienteId: cliente.id } });
    await prisma.cliente.delete({ where: { id: cliente.id } });
    await prisma.fabrica.delete({ where: { id: fabrica.id } });
  }, 15000);
});

describe("criarPedidoManual — gravação e efeitos no cadastro", () => {
  it("não grava pedido quando a auditoria falha (transação)", async () => {
    const fabrica = await prisma.fabrica.create({ data: { nome: "Fábrica Pedido Tx", cnpj: "84000000000101" } });
    const cliente = await prisma.cliente.create({ data: { nomeFantasia: "Cliente Pedido Tx" } });
    obterUsuarioLogadoMock.mockResolvedValue({ id: "usuario-que-nao-existe", nome: "Adm", perfil: "ADMIN", fabricasIds: [] });
    try {
      const resultado = await criarPedidoManual(montarFormData(fabrica.id, cliente.id));

      expect(resultado.erros).toEqual(["Falha ao gravar o pedido. Nada foi salvo — tente novamente."]);
      expect(await prisma.pedido.findMany({ where: { fabricaId: fabrica.id } })).toHaveLength(0);
    } finally {
      await prisma.cliente.delete({ where: { id: cliente.id } });
      await prisma.fabrica.delete({ where: { id: fabrica.id } });
    }
  }, 15000);

  it("recusa fábrica desativada", async () => {
    const fabrica = await prisma.fabrica.create({ data: { nome: "Fábrica Pedido Inativa", cnpj: "84000000000202", ativo: false } });
    const cliente = await prisma.cliente.create({ data: { nomeFantasia: "Cliente Pedido Inativa" } });
    obterUsuarioLogadoMock.mockResolvedValue({ id: "u", nome: "Adm", perfil: "ADMIN", fabricasIds: [] });
    try {
      expect((await criarPedidoManual(montarFormData(fabrica.id, cliente.id))).erros).toEqual([
        "Esta fábrica está desativada.",
      ]);
    } finally {
      await prisma.cliente.delete({ where: { id: cliente.id } });
      await prisma.fabrica.delete({ where: { id: fabrica.id } });
    }
  }, 15000);

  it("o primeiro pedido torna a empresa em prospecção CLIENTE e vincula a fábrica (ADR-013)", async () => {
    const fabrica = await prisma.fabrica.create({ data: { nome: "Fábrica Conversão", cnpj: "84000000000303" } });
    const cliente = await prisma.cliente.create({ data: { nomeFantasia: "Prospect Conversão", situacao: "AVANCO" } });
    const usuario = await prisma.usuario.create({ data: { nome: "Adm", email: "adm-conversao@teste.local", perfil: "ADMIN" } });
    obterUsuarioLogadoMock.mockResolvedValue({ id: usuario.id, nome: "Adm", perfil: "ADMIN", fabricasIds: [] });
    try {
      expect((await criarPedidoManual(montarFormData(fabrica.id, cliente.id))).erros).toEqual([]);

      const lido = await prisma.cliente.findUniqueOrThrow({
        where: { id: cliente.id },
        include: { fabricas: true, interacoes: true },
      });
      expect(lido.situacao).toBe("CLIENTE");
      expect(lido.fabricas.map((f) => f.fabricaId)).toEqual([fabrica.id]);
      expect(lido.interacoes.map((i) => [i.origem, i.resumo])).toEqual([
        ["AUTOMACAO", "Primeiro pedido lançado (PED-AUTHZ-1, Fábrica Conversão): empresa passou a cliente."],
      ]);
    } finally {
      const pedidos = await prisma.pedido.findMany({ where: { clienteId: cliente.id } });
      await prisma.eventoAuditoria.deleteMany({ where: { usuarioId: usuario.id } });
      await prisma.itemPedido.deleteMany({ where: { pedidoId: { in: pedidos.map((p) => p.id) } } });
      await prisma.pedido.deleteMany({ where: { clienteId: cliente.id } });
      await prisma.interacao.deleteMany({ where: { clienteId: cliente.id } });
      await prisma.clienteFabrica.deleteMany({ where: { clienteId: cliente.id } });
      await prisma.cliente.delete({ where: { id: cliente.id } });
      await prisma.usuario.delete({ where: { id: usuario.id } });
      await prisma.fabrica.delete({ where: { id: fabrica.id } });
    }
  }, 15000);
});
