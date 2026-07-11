import { describe, it, expect, vi } from "vitest";
import { prisma } from "@/lib/prisma";

const obterUsuarioLogadoMock = vi.fn();
vi.mock("@/lib/sessao", () => ({
  obterUsuarioLogado: () => obterUsuarioLogadoMock(),
}));

import { avancarRastreio } from "../actions";

describe("avancarRastreio — autorização por fábrica (ADR-009)", () => {
  it("recusa avançar rastreio quando o usuário não tem permissão na fábrica da NFe", async () => {
    const fabrica = await prisma.fabrica.create({ data: { nome: "Fábrica Rastreio Action", cnpj: "80000000002174" } });
    const cliente = await prisma.cliente.create({ data: { cnpj: "80000000002255", nomeFantasia: "Cliente Rastreio Action" } });
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

    try {
      obterUsuarioLogadoMock.mockResolvedValue({ id: "u1", nome: "Op", perfil: "OPERADOR", fabricasIds: ["outra"] });

      const resultado = await avancarRastreio(nota.id, "RECEBIDA", "", "2026-07-03T00:00:00-03:00");

      expect(resultado.erros).toEqual(["Você não tem permissão para atualizar o rastreio desta NFe."]);

      const notaInalterada = await prisma.notaFiscal.findUnique({ where: { id: nota.id } });
      expect(notaInalterada?.status).toBe("TRANSITO");

      const eventos = await prisma.eventoRastreio.findMany({ where: { notaFiscalId: nota.id } });
      expect(eventos).toHaveLength(0);
    } finally {
      await prisma.notaFiscalPedido.deleteMany({ where: { notaFiscalId: nota.id } });
      await prisma.notaFiscal.delete({ where: { id: nota.id } });
      await prisma.pedido.delete({ where: { id: pedido.id } });
      await prisma.cliente.delete({ where: { id: cliente.id } });
      await prisma.fabrica.delete({ where: { id: fabrica.id } });
    }
  }, 15000);
});
