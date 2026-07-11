import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import { obterFabricaIdDaNotaFiscal } from "@/lib/nota-fiscal-fabrica";
import { podeAcessarFabrica } from "@/lib/authz";

describe("guard do relatório de cruzamento — autorização por fábrica (ADR-009)", () => {
  it("bloqueia acesso à NFe de fábrica que o usuário não tem permissão", async () => {
    const fabrica = await prisma.fabrica.create({ data: { nome: "Fábrica Conferência", cnpj: "80000000002336" } });
    const cliente = await prisma.cliente.create({ data: { cnpj: "80000000002417", nomeFantasia: "Cliente Conferência" } });
    const pedido = await prisma.pedido.create({
      data: { numero: "PED-CONF-1", origem: "MANUAL", fabricaId: fabrica.id, clienteId: cliente.id },
    });
    const nota = await prisma.notaFiscal.create({
      data: {
        numero: "9301", chaveAcesso: "35260780000000002336550010000093011123456789",
        emitenteCnpj: fabrica.cnpj, destinatarioCnpj: cliente.cnpj,
        dataEmissao: new Date("2026-07-01T10:00:00-03:00"), totalProdutos: 100, totalNota: 110,
        pedidos: { create: [{ pedidoId: pedido.id }] },
      },
    });

    const operadorSemAcesso = { perfil: "OPERADOR" as const, fabricasIds: ["outra"] };
    const fabricaId = await obterFabricaIdDaNotaFiscal(nota.id);

    expect(fabricaId).toBe(fabrica.id);
    expect(podeAcessarFabrica(operadorSemAcesso, fabricaId!)).toBe(false);

    await prisma.notaFiscalPedido.deleteMany({ where: { notaFiscalId: nota.id } });
    await prisma.notaFiscal.delete({ where: { id: nota.id } });
    await prisma.pedido.delete({ where: { id: pedido.id } });
    await prisma.cliente.delete({ where: { id: cliente.id } });
    await prisma.fabrica.delete({ where: { id: fabrica.id } });
  }, 15000);
});
