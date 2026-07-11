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
