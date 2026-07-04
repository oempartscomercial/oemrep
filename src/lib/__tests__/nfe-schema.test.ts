import { describe, it, expect } from "vitest";
import { prisma } from "../prisma";

describe("schema de NFe", () => {
  it("cria NotaFiscal vinculada a um pedido, com item faturado, e lê de volta", async () => {
    const fabrica = await prisma.fabrica.create({
      data: { nome: "Fábrica Teste NFe", cnpj: "11444777000246" },
    });
    const cliente = await prisma.cliente.create({
      data: { cnpj: "11222333000262", nomeFantasia: "Cliente Teste NFe" },
    });
    const pedido = await prisma.pedido.create({
      data: {
        numero: "PED-NFE-1",
        origem: "MANUAL",
        fabricaId: fabrica.id,
        clienteId: cliente.id,
        itens: {
          create: [
            { referencia: "REF-1", descricao: "Peça 1", quantidadePedida: 10, valorUnitario: 25.5 },
          ],
        },
      },
      include: { itens: true },
    });
    const item = pedido.itens[0];

    const notaFiscal = await prisma.notaFiscal.create({
      data: {
        numero: "1234",
        chaveAcesso: "35260711444777000161550010000012341123456789",
        emitenteCnpj: fabrica.cnpj,
        destinatarioCnpj: cliente.cnpj,
        dataEmissao: new Date("2026-07-01T10:00:00-03:00"),
        totalProdutos: 255,
        totalNota: 260,
        pedidos: { create: [{ pedidoId: pedido.id }] },
        itensFaturados: { create: [{ itemPedidoId: item.id, quantidadeFaturada: 10 }] },
      },
    });

    const lida = await prisma.notaFiscal.findUnique({
      where: { id: notaFiscal.id },
      include: { pedidos: true, itensFaturados: true },
    });

    expect(lida?.status).toBe("TRANSITO");
    expect(lida?.pedidos).toHaveLength(1);
    expect(lida?.pedidos[0].pedidoId).toBe(pedido.id);
    expect(lida?.itensFaturados).toHaveLength(1);
    expect(lida?.itensFaturados[0].quantidadeFaturada).toBe(10);

    await prisma.itemFaturado.deleteMany({ where: { notaFiscalId: notaFiscal.id } });
    await prisma.notaFiscalPedido.deleteMany({ where: { notaFiscalId: notaFiscal.id } });
    await prisma.notaFiscal.delete({ where: { id: notaFiscal.id } });
    await prisma.itemPedido.deleteMany({ where: { pedidoId: pedido.id } });
    await prisma.pedido.delete({ where: { id: pedido.id } });
    await prisma.cliente.delete({ where: { id: cliente.id } });
    await prisma.fabrica.delete({ where: { id: fabrica.id } });
  }, 15000);
});
