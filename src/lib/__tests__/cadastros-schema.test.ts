import { describe, it, expect } from "vitest";
import { prisma } from "../prisma";

describe("schema de cadastros", () => {
  it("cria fábrica e cliente vinculados (N:N) e lê de volta", async () => {
    const fabrica = await prisma.fabrica.create({
      data: { nome: "Bowden Teste", cnpj: "11444777000161" },
    });
    const cliente = await prisma.cliente.create({
      data: { cnpj: "11222333000181", nomeFantasia: "Cliente Teste" },
    });
    await prisma.clienteFabrica.create({
      data: { clienteId: cliente.id, fabricaId: fabrica.id, flagAcessoSistema: true },
    });

    const lido = await prisma.cliente.findUnique({
      where: { id: cliente.id },
      include: { fabricas: true },
    });

    expect(lido?.fabricas).toHaveLength(1);
    expect(lido?.fabricas[0].fabricaId).toBe(fabrica.id);

    await prisma.clienteFabrica.deleteMany({ where: { clienteId: cliente.id } });
    await prisma.cliente.delete({ where: { id: cliente.id } });
    await prisma.fabrica.delete({ where: { id: fabrica.id } });
  });
});
