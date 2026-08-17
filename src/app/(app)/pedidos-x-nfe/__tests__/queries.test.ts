import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import { buscarPedidosParaGap } from "../queries";

describe("buscarPedidosParaGap", () => {
  it("filtra pedidos pela fábrica do usuário", async () => {
    const fabricaA = await prisma.fabrica.create({ data: { nome: "Fábrica A GapQueries", cnpj: "81000000000001" } });
    const fabricaB = await prisma.fabrica.create({ data: { nome: "Fábrica B GapQueries", cnpj: "81000000000002" } });
    const cliente = await prisma.cliente.create({ data: { cnpj: "81000000000003", nomeFantasia: "Cliente Gap Queries" } });

    const pedidoA = await prisma.pedido.create({
      data: {
        numero: "PED-GA-1", origem: "MANUAL", fabricaId: fabricaA.id, clienteId: cliente.id,
        itens: { create: [{ referencia: "REF-A", descricao: "Item A", quantidadePedida: 10, valorUnitario: 5 }] },
      },
    });
    const pedidoB = await prisma.pedido.create({
      data: {
        numero: "PED-GB-1", origem: "MANUAL", fabricaId: fabricaB.id, clienteId: cliente.id,
        itens: { create: [{ referencia: "REF-B", descricao: "Item B", quantidadePedida: 10, valorUnitario: 5 }] },
      },
    });

    try {
      const operadorA = { id: "u1", nome: "Op A", perfil: "OPERADOR" as const, fabricasIds: [fabricaA.id] };

      const lista = await buscarPedidosParaGap(operadorA);

      expect(lista.some((p) => p.fabrica === fabricaA.nome)).toBe(true);
      expect(lista.some((p) => p.fabrica === fabricaB.nome)).toBe(false);
    } finally {
      await prisma.itemPedido.deleteMany({ where: { pedidoId: { in: [pedidoA.id, pedidoB.id] } } });
      await prisma.pedido.deleteMany({ where: { id: { in: [pedidoA.id, pedidoB.id] } } });
      await prisma.cliente.delete({ where: { id: cliente.id } });
      await prisma.fabrica.deleteMany({ where: { id: { in: [fabricaA.id, fabricaB.id] } } });
    }
  }, 15000);

  // O painel de gap valorizava o faturado pelo preço do PEDIDO, então um item pedido a
  // R$100 e faturado a R$120 aparecia com faturado R$100 e gap R$0 — mascarando o
  // sobrefaturamento que o painel existe para achar. Agora usa o preço gravado na baixa.
  it("valoriza o faturado pelo preço da nota, não pelo preço do pedido", async () => {
    const fabrica = await prisma.fabrica.create({ data: { nome: "Fábrica Gap Preço", cnpj: "91000001000191" } });
    const cliente = await prisma.cliente.create({ data: { cnpj: "91000002000136", nomeFantasia: "Cliente Gap Preço" } });
    const nota = await prisma.notaFiscal.create({
      data: {
        numero: "9001", chaveAcesso: "35260791000001000191550010000090011000000001",
        emitenteCnpj: fabrica.cnpj, destinatarioCnpj: cliente.cnpj, dataEmissao: new Date("2026-07-01"),
        totalProdutos: 1200, totalNota: 1200,
      },
    });
    const pedido = await prisma.pedido.create({
      data: {
        numero: "PED-GAP-PRECO", origem: "MANUAL", fabricaId: fabrica.id, clienteId: cliente.id,
        itens: { create: [{ referencia: "REF-1", descricao: "Peça", quantidadePedida: 10, quantidadeFaturada: 10, valorUnitario: 100, status: "OK" }] },
      },
      include: { itens: true },
    });
    const faturado = await prisma.itemFaturado.create({
      data: { itemPedidoId: pedido.itens[0].id, notaFiscalId: nota.id, quantidadeFaturada: 10, valorUnitario: 120 },
    });

    try {
      const admin = { id: "u1", nome: "Chefe", perfil: "ADMIN" as const, fabricasIds: [] };

      const lista = await buscarPedidosParaGap(admin);
      const linha = lista.find((p) => p.cliente === cliente.nomeFantasia);

      expect(linha?.itensFaturados[0].valorUnitario).toBe(120);
    } finally {
      await prisma.itemFaturado.delete({ where: { id: faturado.id } });
      await prisma.itemPedido.deleteMany({ where: { pedidoId: pedido.id } });
      await prisma.pedido.delete({ where: { id: pedido.id } });
      await prisma.notaFiscal.delete({ where: { id: nota.id } });
      await prisma.cliente.delete({ where: { id: cliente.id } });
      await prisma.fabrica.delete({ where: { id: fabrica.id } });
    }
  }, 15000);
});
