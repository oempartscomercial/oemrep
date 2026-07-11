import { describe, it, expect } from "vitest";
import { prisma } from "../prisma";
import { obterFabricaIdDaNotaFiscal } from "../nota-fiscal-fabrica";

describe("obterFabricaIdDaNotaFiscal", () => {
  it("resolve a fábrica de uma NFe via o pedido vinculado", async () => {
    const fabrica = await prisma.fabrica.create({
      data: { nome: "Fábrica NF Fabrica", cnpj: "80000000000120" },
    });
    const cliente = await prisma.cliente.create({
      data: { cnpj: "80000000000201", nomeFantasia: "Cliente NF Fabrica" },
    });
    const pedido = await prisma.pedido.create({
      data: { numero: "PED-NFF-1", origem: "MANUAL", fabricaId: fabrica.id, clienteId: cliente.id },
    });
    const notaFiscal = await prisma.notaFiscal.create({
      data: {
        numero: "9001",
        chaveAcesso: "35260780000000000120550010000090011123456789",
        emitenteCnpj: fabrica.cnpj,
        destinatarioCnpj: cliente.cnpj,
        dataEmissao: new Date("2026-07-01T10:00:00-03:00"),
        totalProdutos: 100,
        totalNota: 110,
        pedidos: { create: [{ pedidoId: pedido.id }] },
      },
    });

    const fabricaId = await obterFabricaIdDaNotaFiscal(notaFiscal.id);
    expect(fabricaId).toBe(fabrica.id);

    await prisma.notaFiscalPedido.deleteMany({ where: { notaFiscalId: notaFiscal.id } });
    await prisma.notaFiscal.delete({ where: { id: notaFiscal.id } });
    await prisma.pedido.delete({ where: { id: pedido.id } });
    await prisma.cliente.delete({ where: { id: cliente.id } });
    await prisma.fabrica.delete({ where: { id: fabrica.id } });
  }, 15000);

  it("retorna null quando a NFe não tem nenhum pedido vinculado", async () => {
    const fabricaId = await obterFabricaIdDaNotaFiscal("id-inexistente");
    expect(fabricaId).toBeNull();
  });
});
