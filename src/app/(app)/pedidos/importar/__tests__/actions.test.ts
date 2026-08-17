import { describe, it, expect, vi } from "vitest";
import { prisma } from "@/lib/prisma";

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const obterUsuarioLogadoMock = vi.fn();
vi.mock("@/lib/sessao", () => ({
  obterUsuarioLogado: () => obterUsuarioLogadoMock(),
}));

import { confirmarImportacao } from "../actions";

describe("confirmarImportacao — autorização por fábrica (ADR-009)", () => {
  it("recusa importar pedido para fábrica sem permissão", async () => {
    const fabrica = await prisma.fabrica.create({
      data: { nome: "Fábrica Importação", cnpj: "80000000001607" },
    });
    const cliente = await prisma.cliente.create({
      data: { cnpj: "80000000001798", nomeFantasia: "Cliente Importação" },
    });
    obterUsuarioLogadoMock.mockResolvedValue({ id: "u1", nome: "Op", perfil: "OPERADOR", fabricasIds: ["outra"] });

    const resultado = await confirmarImportacao({
      fabricaId: fabrica.id,
      clienteId: cliente.id,
      numero: "PED-IMP-1",
      semNumero: false,
      itens: [{ referencia: "REF-1", descricao: "Peça", quantidade: 1, valorUnitario: 10 }],
    });

    expect(resultado.erros).toEqual(["Você não tem permissão para importar pedidos para esta fábrica."]);
    const pedidos = await prisma.pedido.findMany({ where: { fabricaId: fabrica.id } });
    expect(pedidos).toHaveLength(0);

    await prisma.cliente.delete({ where: { id: cliente.id } });
    await prisma.fabrica.delete({ where: { id: fabrica.id } });
  }, 15000);
});

describe("confirmarImportacao — falha de gravação", () => {
  it("devolve mensagem legível em vez de estourar quando a gravação falha", async () => {
    const fabrica = await prisma.fabrica.create({
      data: { nome: "Fábrica Falha Gravação", cnpj: "80000000001880" },
    });
    obterUsuarioLogadoMock.mockResolvedValue({ id: "u1", nome: "Adm", perfil: "ADMIN", fabricasIds: [] });

    try {
      // clienteId inexistente: o Postgres recusa a FK e o Prisma lança.
      const resultado = await confirmarImportacao({
        fabricaId: fabrica.id,
        clienteId: "cliente-que-nao-existe",
        numero: "PED-IMP-FALHA",
        semNumero: false,
        itens: [{ referencia: "REF-1", descricao: "Peça", quantidade: 1, valorUnitario: 10 }],
      });

      expect(resultado.erros).toEqual([
        "Falha ao gravar o pedido. Nada foi salvo — tente novamente.",
      ]);
    } finally {
      await prisma.fabrica.delete({ where: { id: fabrica.id } });
    }
  }, 15000);

  it("não deixa o pedido gravado quando a auditoria falha", async () => {
    const fabrica = await prisma.fabrica.create({
      data: { nome: "Fábrica Falha Auditoria", cnpj: "80000000001961" },
    });
    const cliente = await prisma.cliente.create({
      data: { cnpj: "80000000002042", nomeFantasia: "Cliente Falha Auditoria" },
    });
    // Usuário fora da tabela Usuario: o pedido grava, mas a auditoria viola a FK.
    // Sem transação, sobraria um pedido sem rastro de auditoria (regra 4 do CLAUDE.md).
    obterUsuarioLogadoMock.mockResolvedValue({
      id: "usuario-que-nao-existe",
      nome: "Adm",
      perfil: "ADMIN",
      fabricasIds: [],
    });

    try {
      const resultado = await confirmarImportacao({
        fabricaId: fabrica.id,
        clienteId: cliente.id,
        numero: "PED-IMP-AUDIT",
        semNumero: false,
        itens: [{ referencia: "REF-1", descricao: "Peça", quantidade: 1, valorUnitario: 10 }],
      });

      expect(resultado.erros).toEqual([
        "Falha ao gravar o pedido. Nada foi salvo — tente novamente.",
      ]);
      const pedidos = await prisma.pedido.findMany({ where: { fabricaId: fabrica.id } });
      expect(pedidos).toHaveLength(0);
    } finally {
      await prisma.itemPedido.deleteMany({ where: { pedido: { fabricaId: fabrica.id } } });
      await prisma.pedido.deleteMany({ where: { fabricaId: fabrica.id } });
      await prisma.cliente.delete({ where: { id: cliente.id } });
      await prisma.fabrica.delete({ where: { id: fabrica.id } });
    }
  }, 15000);
});
