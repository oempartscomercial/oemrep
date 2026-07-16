import { describe, it, expect } from "vitest";
import { prisma } from "../prisma";

describe("schema de Chamado/MotivoChamado/ChamadoItem/EventoChamado", () => {
  it("abre um chamado vinculado a uma NFe e a itens do pedido, com thread de eventos", async () => {
    const fabrica = await prisma.fabrica.create({
      data: { nome: "Fábrica Chamado", cnpj: "11222333000181" },
    });
    const cliente = await prisma.cliente.create({
      data: { cnpj: "22333444000192", nomeFantasia: "Cliente Chamado" },
    });
    const usuario = await prisma.usuario.create({
      data: { nome: "Analista Chamado", email: "chamado-schema@teste.dev" },
    });
    const pedido = await prisma.pedido.create({
      data: {
        numero: "PED-CH-1",
        origem: "MANUAL",
        fabricaId: fabrica.id,
        clienteId: cliente.id,
        itens: {
          create: [
            { referencia: "REF-1", descricao: "Item 1", quantidadePedida: 10, valorUnitario: 5 },
          ],
        },
      },
      include: { itens: true },
    });
    const notaFiscal = await prisma.notaFiscal.create({
      data: {
        numero: "7777",
        chaveAcesso: "35260711222333000181550010000077771123456789",
        emitenteCnpj: fabrica.cnpj,
        destinatarioCnpj: cliente.cnpj,
        dataEmissao: new Date("2026-07-01T10:00:00-03:00"),
        totalProdutos: 50,
        totalNota: 55,
        pedidos: { create: [{ pedidoId: pedido.id }] },
        itensFaturados: {
          create: [{ itemPedidoId: pedido.itens[0].id, quantidadeFaturada: 10 }],
        },
      },
    });
    const motivo = await prisma.motivoChamado.create({ data: { nome: "Item quebrado (teste)" } });

    const chamado = await prisma.chamado.create({
      data: {
        notaFiscalId: notaFiscal.id,
        motivoId: motivo.id,
        abertoPorId: usuario.id,
        itensAfetados: { create: [{ itemPedidoId: pedido.itens[0].id }] },
        eventos: {
          create: [
            {
              estado: "ABERTO",
              estadoAnterior: null,
              observacao: "Item chegou quebrado.",
              usuarioId: usuario.id,
            },
          ],
        },
      },
    });

    const chamadoCompleto = await prisma.chamado.findUnique({
      where: { id: chamado.id },
      include: {
        itensAfetados: { include: { itemPedido: true } },
        eventos: { include: { usuario: true } },
        motivo: true,
      },
    });

    expect(chamadoCompleto?.estado).toBe("ABERTO");
    expect(chamadoCompleto?.motivo.nome).toBe("Item quebrado (teste)");
    expect(chamadoCompleto?.itensAfetados).toHaveLength(1);
    expect(chamadoCompleto?.itensAfetados[0].itemPedido.referencia).toBe("REF-1");
    expect(chamadoCompleto?.eventos).toHaveLength(1);
    expect(chamadoCompleto?.eventos[0].estadoAnterior).toBeNull();
    expect(chamadoCompleto?.eventos[0].observacao).toBe("Item chegou quebrado.");
    expect(chamadoCompleto?.eventos[0].usuario.nome).toBe("Analista Chamado");

    await prisma.eventoChamado.deleteMany({ where: { chamadoId: chamado.id } });
    await prisma.chamadoItem.deleteMany({ where: { chamadoId: chamado.id } });
    await prisma.chamado.delete({ where: { id: chamado.id } });
    await prisma.motivoChamado.delete({ where: { id: motivo.id } });
    await prisma.itemFaturado.deleteMany({ where: { notaFiscalId: notaFiscal.id } });
    await prisma.notaFiscalPedido.deleteMany({ where: { notaFiscalId: notaFiscal.id } });
    await prisma.notaFiscal.delete({ where: { id: notaFiscal.id } });
    await prisma.itemPedido.deleteMany({ where: { pedidoId: pedido.id } });
    await prisma.pedido.delete({ where: { id: pedido.id } });
    await prisma.usuario.delete({ where: { id: usuario.id } });
    await prisma.cliente.delete({ where: { id: cliente.id } });
    await prisma.fabrica.delete({ where: { id: fabrica.id } });
  }, 15000);
});
