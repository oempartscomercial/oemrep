import { describe, it, expect, vi } from "vitest";
import { prisma } from "@/lib/prisma";

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const obterUsuarioLogadoMock = vi.fn();
vi.mock("@/lib/sessao", () => ({
  obterUsuarioLogado: () => obterUsuarioLogadoMock(),
}));

import { atualizarStatusItem, arquivarPedido, reabrirPedido } from "../actions";

async function criarPedidoDeTeste(cnpjFabrica: string, cnpjCliente: string, estado: "SEM_NFE" | "COMPLETO" | "ARQUIVADO" = "SEM_NFE") {
  const fabrica = await prisma.fabrica.create({ data: { nome: "Fábrica Detalhe Pedido", cnpj: cnpjFabrica } });
  const cliente = await prisma.cliente.create({ data: { cnpj: cnpjCliente, nomeFantasia: "Cliente Detalhe Pedido" } });
  const pedido = await prisma.pedido.create({
    data: {
      numero: "PED-DET-1",
      origem: "MANUAL",
      estado,
      fabricaId: fabrica.id,
      clienteId: cliente.id,
      itens: {
        create: [{ referencia: "REF-1", descricao: "Peça", quantidadePedida: 1, valorUnitario: 10 }],
      },
    },
    include: { itens: true },
  });
  return { fabrica, cliente, pedido };
}

async function limpar(fabrica: { id: string }, cliente: { id: string }, pedido: { id: string }) {
  await prisma.eventoAuditoria.deleteMany({ where: { entidadeId: pedido.id } });
  await prisma.itemPedido.deleteMany({ where: { pedidoId: pedido.id } });
  await prisma.pedido.delete({ where: { id: pedido.id } });
  await prisma.cliente.delete({ where: { id: cliente.id } });
  await prisma.fabrica.delete({ where: { id: fabrica.id } });
}

describe("actions de detalhe de pedido — autorização por fábrica (ADR-009)", () => {
  it("atualizarStatusItem recusa quando usuário não tem permissão na fábrica do pedido", async () => {
    const { fabrica, cliente, pedido } = await criarPedidoDeTeste("80000000001011", "80000000001100");
    obterUsuarioLogadoMock.mockResolvedValue({ id: "u1", nome: "Op", perfil: "OPERADOR", fabricasIds: ["outra"] });

    const resultado = await atualizarStatusItem(pedido.itens[0].id, "OK", "");

    expect(resultado.erros).toEqual(["Você não tem permissão para alterar itens desta fábrica."]);
    const itemInalterado = await prisma.itemPedido.findUnique({ where: { id: pedido.itens[0].id } });
    expect(itemInalterado?.status).toBe("PENDENTE");

    await limpar(fabrica, cliente, pedido);
  }, 15000);

  it("arquivarPedido recusa quando usuário não tem permissão na fábrica do pedido", async () => {
    const { fabrica, cliente, pedido } = await criarPedidoDeTeste("80000000001283", "80000000001364", "COMPLETO");
    obterUsuarioLogadoMock.mockResolvedValue({ id: "u1", nome: "Op", perfil: "OPERADOR", fabricasIds: ["outra"] });

    const resultado = await arquivarPedido(pedido.id);

    expect(resultado.erros).toEqual(["Você não tem permissão para alterar pedidos desta fábrica."]);
    const pedidoInalterado = await prisma.pedido.findUnique({ where: { id: pedido.id } });
    expect(pedidoInalterado?.estado).toBe("COMPLETO");

    await limpar(fabrica, cliente, pedido);
  }, 15000);

  it("reabrirPedido permite quando usuário tem permissão na fábrica do pedido", async () => {
    const { fabrica, cliente, pedido } = await criarPedidoDeTeste("80000000001445", "80000000001526", "ARQUIVADO");
    const usuario = await prisma.usuario.create({
      data: { nome: "Op", email: "op-authz-reabrir@example.com", perfil: "OPERADOR" },
    });
    obterUsuarioLogadoMock.mockResolvedValue({ id: usuario.id, nome: "Op", perfil: "OPERADOR", fabricasIds: [fabrica.id] });

    const resultado = await reabrirPedido(pedido.id);

    expect(resultado.erros).toEqual([]);
    const pedidoAtualizado = await prisma.pedido.findUnique({ where: { id: pedido.id } });
    expect(pedidoAtualizado?.estado).toBe("COMPLETO");

    await limpar(fabrica, cliente, pedido);
    await prisma.usuario.delete({ where: { id: usuario.id } });
  }, 15000);
});
