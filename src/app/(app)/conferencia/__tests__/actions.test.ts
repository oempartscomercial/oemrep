import { describe, it, expect, vi } from "vitest";
import { prisma } from "@/lib/prisma";

const obterUsuarioLogadoMock = vi.fn();
vi.mock("@/lib/sessao", () => ({
  obterUsuarioLogado: () => obterUsuarioLogadoMock(),
}));

import { confirmarBaixaNFe, type AnaliseNFe } from "../actions";

describe("confirmarBaixaNFe — autorização por fábrica (ADR-009)", () => {
  it("recusa confirmar baixa em fábrica que o usuário não tem permissão", async () => {
    const fabrica = await prisma.fabrica.create({ data: { nome: "Fábrica Conferência Action", cnpj: "80000000002506" } });
    const cliente = await prisma.cliente.create({ data: { cnpj: "80000000002689", nomeFantasia: "Cliente Conferência Action" } });
    const pedido = await prisma.pedido.create({
      data: {
        numero: "PED-CONFA-1", origem: "MANUAL", fabricaId: fabrica.id, clienteId: cliente.id,
        itens: { create: [{ referencia: "REF-1", descricao: "Peça", quantidadePedida: 10, valorUnitario: 25 }] },
      },
      include: { itens: true },
    });

    try {
      obterUsuarioLogadoMock.mockResolvedValue({ id: "u1", nome: "Op", perfil: "OPERADOR", fabricasIds: ["outra"] });

      const analise: AnaliseNFe = {
        nfe: {
          numero: "9401",
          chaveAcesso: "35260780000000002506550010000094011123456789",
          emitenteCnpj: fabrica.cnpj,
          destinatarioCnpj: cliente.cnpj,
          dataEmissao: "2026-07-01T10:00:00-03:00",
          totalProdutos: 250,
          totalNota: 260,
          itens: [{ referencia: "REF-1", descricao: "Peça", quantidade: 10, valorUnitario: 25 }],
        },
        clienteId: cliente.id,
        fabricaId: fabrica.id,
        conferencia: [
          {
            itemNFe: { referencia: "REF-1", descricao: "Peça", quantidade: 10, valorUnitario: 25 },
            pendencia: {
              itemPedidoId: pedido.itens[0].id,
              pedidoId: pedido.id,
              clienteCnpj: cliente.cnpj,
              referencia: "REF-1",
              quantidadePendente: 10,
              valorUnitario: 25,
            },
            divergencias: [],
          },
        ],
      };

      const resultado = await confirmarBaixaNFe(analise);

      expect(resultado.erros).toEqual(["Você não tem permissão para confirmar baixas nesta fábrica."]);
      const notasCriadas = await prisma.notaFiscal.findMany({ where: { chaveAcesso: analise.nfe.chaveAcesso } });
      expect(notasCriadas).toHaveLength(0);
    } finally {
      await prisma.itemPedido.deleteMany({ where: { pedidoId: pedido.id } });
      await prisma.pedido.delete({ where: { id: pedido.id } });
      await prisma.cliente.delete({ where: { id: cliente.id } });
      await prisma.fabrica.delete({ where: { id: fabrica.id } });
    }
  }, 15000);
});
