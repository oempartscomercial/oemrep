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

describe("confirmarBaixaNFe — falha de gravação", () => {
  it("devolve mensagem legível em vez de estourar quando a criação da nota fiscal falha", async () => {
    const fabrica = await prisma.fabrica.create({ data: { nome: "Fábrica Falha NFe", cnpj: "80000000003100" } });
    const cliente = await prisma.cliente.create({ data: { cnpj: "80000000003209", nomeFantasia: "Cliente Falha NFe" } });
    const pedido = await prisma.pedido.create({
      data: {
        numero: "PED-CONFA-2", origem: "MANUAL", fabricaId: fabrica.id, clienteId: cliente.id,
        itens: { create: [{ referencia: "REF-1", descricao: "Peça", quantidadePedida: 10, valorUnitario: 25 }] },
      },
      include: { itens: true },
    });
    const chaveAcesso = "35260780000000003100550010000095011123456789";
    // NFe pré-existente com a mesma chave: o unique constraint faz o create falhar de
    // imediato, antes de qualquer baixa de item ser aplicada.
    const notaExistente = await prisma.notaFiscal.create({
      data: {
        numero: "9500", chaveAcesso, emitenteCnpj: fabrica.cnpj, destinatarioCnpj: cliente.cnpj,
        dataEmissao: new Date("2026-07-01T10:00:00-03:00"), totalProdutos: 1, totalNota: 1,
      },
    });

    try {
      obterUsuarioLogadoMock.mockResolvedValue({ id: "u1", nome: "Adm", perfil: "ADMIN", fabricasIds: [] });

      const analise: AnaliseNFe = {
        nfe: {
          numero: "9501",
          chaveAcesso,
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

      expect(resultado.erros).toEqual(["Falha ao gravar a baixa da NFe. Nada foi salvo — tente novamente."]);
      const item = await prisma.itemPedido.findUniqueOrThrow({ where: { id: pedido.itens[0].id } });
      expect(item.quantidadeFaturada).toBe(0);
      expect(item.status).toBe("PENDENTE");
    } finally {
      await prisma.itemFaturado.deleteMany({ where: { notaFiscalId: notaExistente.id } });
      await prisma.notaFiscal.delete({ where: { id: notaExistente.id } });
      await prisma.itemPedido.deleteMany({ where: { pedidoId: pedido.id } });
      await prisma.pedido.delete({ where: { id: pedido.id } });
      await prisma.cliente.delete({ where: { id: cliente.id } });
      await prisma.fabrica.delete({ where: { id: fabrica.id } });
    }
  }, 15000);

  it("não deixa nada gravado quando a gravação falha no meio da sequência (auditoria)", async () => {
    const fabrica = await prisma.fabrica.create({ data: { nome: "Fábrica Falha Auditoria NFe", cnpj: "80000000003308" } });
    const cliente = await prisma.cliente.create({ data: { cnpj: "80000000003407", nomeFantasia: "Cliente Falha Auditoria NFe" } });
    const pedido = await prisma.pedido.create({
      data: {
        numero: "PED-CONFA-3", origem: "MANUAL", fabricaId: fabrica.id, clienteId: cliente.id,
        itens: { create: [{ referencia: "REF-1", descricao: "Peça", quantidadePedida: 10, valorUnitario: 25 }] },
      },
      include: { itens: true },
    });
    const chaveAcesso = "35260780000000003308550010000095021123456789";
    // Usuário fora da tabela Usuario: NotaFiscal e ItemPedido chegam a ser
    // gravados no fluxo antigo (sem transação), e só a auditoria falha por FK — a
    // baixa parcial some no ar sem o pedido nunca saber.
    obterUsuarioLogadoMock.mockResolvedValue({
      id: "usuario-que-nao-existe", nome: "Adm", perfil: "ADMIN", fabricasIds: [],
    });

    try {
      const analise: AnaliseNFe = {
        nfe: {
          numero: "9502",
          chaveAcesso,
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

      expect(resultado.erros).toEqual(["Falha ao gravar a baixa da NFe. Nada foi salvo — tente novamente."]);

      const notasCriadas = await prisma.notaFiscal.findMany({ where: { chaveAcesso } });
      expect(notasCriadas).toHaveLength(0);

      const item = await prisma.itemPedido.findUniqueOrThrow({ where: { id: pedido.itens[0].id } });
      expect(item.quantidadeFaturada).toBe(0);
      expect(item.status).toBe("PENDENTE");

      const itensFaturados = await prisma.itemFaturado.findMany({ where: { itemPedidoId: pedido.itens[0].id } });
      expect(itensFaturados).toHaveLength(0);

      const pedidoAtual = await prisma.pedido.findUniqueOrThrow({ where: { id: pedido.id } });
      expect(pedidoAtual.estado).toBe("SEM_NFE");
    } finally {
      await prisma.itemFaturado.deleteMany({ where: { itemPedidoId: pedido.itens[0].id } });
      await prisma.notaFiscalPedido.deleteMany({ where: { pedidoId: pedido.id } });
      await prisma.notaFiscal.deleteMany({ where: { chaveAcesso } });
      await prisma.itemPedido.deleteMany({ where: { pedidoId: pedido.id } });
      await prisma.pedido.delete({ where: { id: pedido.id } });
      await prisma.cliente.delete({ where: { id: cliente.id } });
      await prisma.fabrica.delete({ where: { id: fabrica.id } });
    }
  }, 15000);
});
