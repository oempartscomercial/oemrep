import { describe, it, expect, vi } from "vitest";
import { prisma } from "@/lib/prisma";

const obterUsuarioLogadoMock = vi.fn();
vi.mock("@/lib/sessao", () => ({
  obterUsuarioLogado: () => obterUsuarioLogadoMock(),
}));

import { abrirChamado } from "../actions";

describe("abrirChamado — autorização por fábrica (ADR-009) e regras (RF25/RF30)", () => {
  it("recusa abrir chamado quando o usuário não tem permissão na fábrica da NFe", async () => {
    const fabrica = await prisma.fabrica.create({ data: { nome: "Fábrica Chamado Action", cnpj: "90000000002175" } });
    const cliente = await prisma.cliente.create({ data: { cnpj: "90000000002256", nomeFantasia: "Cliente Chamado Action" } });
    const pedido = await prisma.pedido.create({
      data: {
        numero: "PED-CHACT-1",
        origem: "MANUAL",
        fabricaId: fabrica.id,
        clienteId: cliente.id,
        itens: { create: [{ referencia: "REF-A", descricao: "Item A", quantidadePedida: 5, valorUnitario: 10 }] },
      },
      include: { itens: true },
    });
    const nota = await prisma.notaFiscal.create({
      data: {
        numero: "9301", chaveAcesso: "35260790000000002175550010000093011123456789",
        emitenteCnpj: fabrica.cnpj, destinatarioCnpj: cliente.cnpj,
        dataEmissao: new Date("2026-07-01T10:00:00-03:00"), totalProdutos: 50, totalNota: 55,
        pedidos: { create: [{ pedidoId: pedido.id }] },
        itensFaturados: { create: [{ itemPedidoId: pedido.itens[0].id, quantidadeFaturada: 5 }] },
      },
    });
    const motivo = await prisma.motivoChamado.create({ data: { nome: "Extravio (teste ação)" } });

    try {
      obterUsuarioLogadoMock.mockResolvedValue({ id: "u1", nome: "Op", perfil: "OPERADOR", fabricasIds: ["outra"] });

      const formData = new FormData();
      formData.set("notaFiscalId", nota.id);
      formData.set("motivoId", motivo.id);
      formData.set("observacao", "Nota extraviada no transporte.");
      formData.append("itemPedidoId", pedido.itens[0].id);

      const resultado = await abrirChamado(formData);

      expect(resultado.erros).toEqual(["Você não tem permissão para abrir chamados para esta NFe."]);

      const chamados = await prisma.chamado.findMany({ where: { notaFiscalId: nota.id } });
      expect(chamados).toHaveLength(0);
    } finally {
      await prisma.motivoChamado.delete({ where: { id: motivo.id } });
      await prisma.itemFaturado.deleteMany({ where: { notaFiscalId: nota.id } });
      await prisma.notaFiscalPedido.deleteMany({ where: { notaFiscalId: nota.id } });
      await prisma.notaFiscal.delete({ where: { id: nota.id } });
      await prisma.itemPedido.deleteMany({ where: { pedidoId: pedido.id } });
      await prisma.pedido.delete({ where: { id: pedido.id } });
      await prisma.cliente.delete({ where: { id: cliente.id } });
      await prisma.fabrica.delete({ where: { id: fabrica.id } });
    }
  }, 15000);
});
