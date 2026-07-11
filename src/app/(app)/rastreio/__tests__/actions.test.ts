import { describe, it, expect, vi } from "vitest";
import { prisma } from "@/lib/prisma";

const obterUsuarioLogadoMock = vi.fn();
vi.mock("@/lib/sessao", () => ({
  obterUsuarioLogado: () => obterUsuarioLogadoMock(),
}));

import { avancarRastreio } from "../actions";

describe("avancarRastreio — autorização por fábrica (ADR-009)", () => {
  it("recusa avançar rastreio quando o usuário não tem permissão na fábrica da NFe", async () => {
    // Clean up existing test data
    const testCnpjFabrica = "80000000002174";
    const testCnpjOutra = "80000000002182";
    const testCnpjCliente = "80000000002255";

    await prisma.eventoRastreio.deleteMany({
      where: { notaFiscal: { emitenteCnpj: testCnpjFabrica } }
    });
    await prisma.notaFiscalPedido.deleteMany({
      where: { notaFiscal: { emitenteCnpj: testCnpjFabrica } }
    });
    await prisma.notaFiscal.deleteMany({ where: { emitenteCnpj: testCnpjFabrica } });
    await prisma.pedido.deleteMany({
      where: { fabrica: { cnpj: testCnpjFabrica } }
    });
    await prisma.usuarioFabrica.deleteMany({
      where: { fabrica: { cnpj: testCnpjOutra } }
    });
    await prisma.eventoAuditoria.deleteMany({
      where: { usuarioId: "u1" }
    });
    await prisma.usuario.deleteMany({
      where: { email: "op@test.com" }
    });
    await prisma.fabrica.deleteMany({ where: { cnpj: { in: [testCnpjFabrica, testCnpjOutra] } } });
    await prisma.cliente.deleteMany({ where: { cnpj: testCnpjCliente } });

    const fabrica = await prisma.fabrica.create({ data: { nome: "Fábrica Rastreio Action", cnpj: testCnpjFabrica } });
    const outrafabrica = await prisma.fabrica.create({ data: { nome: "Outra Fábrica", cnpj: testCnpjOutra } });
    const cliente = await prisma.cliente.create({ data: { cnpj: testCnpjCliente, nomeFantasia: "Cliente Rastreio Action" } });
    const usuario = await prisma.usuario.create({
      data: {
        id: "u1",
        email: "op@test.com",
        nome: "Op",
        perfil: "OPERADOR",
        fabricas: { create: [{ fabricaId: outrafabrica.id }] },
      },
    });
    const pedido = await prisma.pedido.create({
      data: { numero: "PED-RACT-1", origem: "MANUAL", fabricaId: fabrica.id, clienteId: cliente.id },
    });
    const nota = await prisma.notaFiscal.create({
      data: {
        numero: "9201", chaveAcesso: "35260780000000002174550010000092011123456789",
        emitenteCnpj: fabrica.cnpj, destinatarioCnpj: cliente.cnpj,
        dataEmissao: new Date("2026-07-01T10:00:00-03:00"), totalProdutos: 100, totalNota: 110,
        pedidos: { create: [{ pedidoId: pedido.id }] },
      },
    });

    obterUsuarioLogadoMock.mockResolvedValue({ id: usuario.id, nome: usuario.nome, perfil: usuario.perfil, fabricasIds: [outrafabrica.id] });

    const resultado = await avancarRastreio(nota.id, "RECEBIDA", "", "2026-07-03T00:00:00-03:00");

    expect(resultado.erros).toEqual(["Você não tem permissão para atualizar o rastreio desta NFe."]);
    const notaInalterada = await prisma.notaFiscal.findUnique({ where: { id: nota.id } });
    expect(notaInalterada?.status).toBe("TRANSITO");

    await prisma.notaFiscalPedido.deleteMany({ where: { notaFiscalId: nota.id } });
    await prisma.notaFiscal.delete({ where: { id: nota.id } });
    await prisma.pedido.delete({ where: { id: pedido.id } });
    await prisma.usuarioFabrica.deleteMany({ where: { usuarioId: usuario.id } });
    await prisma.usuario.delete({ where: { id: usuario.id } });
    await prisma.cliente.delete({ where: { id: cliente.id } });
    await prisma.fabrica.delete({ where: { id: fabrica.id } });
    await prisma.fabrica.delete({ where: { id: outrafabrica.id } });
  }, 15000);
});
