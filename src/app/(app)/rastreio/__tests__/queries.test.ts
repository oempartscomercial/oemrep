import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import { buscarNotasFiscaisPermitidas, buscarNotaFiscalComPermissao } from "../queries";

describe("buscarNotasFiscaisPermitidas / buscarNotaFiscalComPermissao", () => {
  it("filtra NFes pela fábrica do usuário via o pedido vinculado", async () => {
    const fabricaA = await prisma.fabrica.create({ data: { nome: "Fábrica A Rastreio", cnpj: "80000000001879" } });
    const fabricaB = await prisma.fabrica.create({ data: { nome: "Fábrica B Rastreio", cnpj: "80000000001950" } });
    const cliente = await prisma.cliente.create({ data: { cnpj: "80000000002093", nomeFantasia: "Cliente Rastreio Queries" } });

    const pedidoA = await prisma.pedido.create({
      data: { numero: "PED-RA-1", origem: "MANUAL", fabricaId: fabricaA.id, clienteId: cliente.id },
    });
    const pedidoB = await prisma.pedido.create({
      data: { numero: "PED-RB-1", origem: "MANUAL", fabricaId: fabricaB.id, clienteId: cliente.id },
    });

    const notaA = await prisma.notaFiscal.create({
      data: {
        numero: "9101", chaveAcesso: "35260780000000001879550010000091011123456789",
        emitenteCnpj: fabricaA.cnpj, destinatarioCnpj: cliente.cnpj,
        dataEmissao: new Date("2026-07-01T10:00:00-03:00"), totalProdutos: 100, totalNota: 110,
        pedidos: { create: [{ pedidoId: pedidoA.id }] },
      },
    });
    const notaB = await prisma.notaFiscal.create({
      data: {
        numero: "9102", chaveAcesso: "35260780000000001950550010000091021123456789",
        emitenteCnpj: fabricaB.cnpj, destinatarioCnpj: cliente.cnpj,
        dataEmissao: new Date("2026-07-01T10:00:00-03:00"), totalProdutos: 100, totalNota: 110,
        pedidos: { create: [{ pedidoId: pedidoB.id }] },
      },
    });

    const operadorA = { id: "u1", nome: "Op A", perfil: "OPERADOR" as const, fabricasIds: [fabricaA.id] };

    const listaOperador = await buscarNotasFiscaisPermitidas(operadorA);
    expect(listaOperador.map((n) => n.id)).toContain(notaA.id);
    expect(listaOperador.map((n) => n.id)).not.toContain(notaB.id);

    const detalhePermitido = await buscarNotaFiscalComPermissao(notaA.id, operadorA);
    expect(detalhePermitido?.id).toBe(notaA.id);

    const detalheNegado = await buscarNotaFiscalComPermissao(notaB.id, operadorA);
    expect(detalheNegado).toBeNull();

    await prisma.notaFiscalPedido.deleteMany({ where: { notaFiscalId: { in: [notaA.id, notaB.id] } } });
    await prisma.notaFiscal.deleteMany({ where: { id: { in: [notaA.id, notaB.id] } } });
    await prisma.pedido.deleteMany({ where: { id: { in: [pedidoA.id, pedidoB.id] } } });
    await prisma.cliente.delete({ where: { id: cliente.id } });
    await prisma.fabrica.deleteMany({ where: { id: { in: [fabricaA.id, fabricaB.id] } } });
  }, 15000);
});
