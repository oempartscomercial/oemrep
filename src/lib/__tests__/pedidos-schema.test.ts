import { describe, it, expect } from "vitest";
import { prisma } from "../prisma";

describe("schema de pedidos", () => {
  it("cria pedido com itens vinculados e lê de volta", async () => {
    const fabrica = await prisma.fabrica.create({
      data: { nome: "Fábrica Teste Pedido", cnpj: "11444777000246" },
    });
    const cliente = await prisma.cliente.create({
      data: { cnpj: "11222333000262", nomeFantasia: "Cliente Teste Pedido" },
    });

    const pedido = await prisma.pedido.create({
      data: {
        numero: "PED-001",
        origem: "MANUAL",
        fabricaId: fabrica.id,
        clienteId: cliente.id,
        itens: {
          create: [
            {
              referencia: "REF-1",
              descricao: "Peça 1",
              quantidadePedida: 10,
              valorUnitario: 25.5,
            },
          ],
        },
      },
    });

    const lido = await prisma.pedido.findUnique({
      where: { id: pedido.id },
      include: { itens: true },
    });

    expect(lido?.estado).toBe("SEM_NFE");
    expect(lido?.itens).toHaveLength(1);
    expect(lido?.itens[0].status).toBe("PENDENTE");
    expect(Number(lido?.itens[0].valorUnitario)).toBe(25.5);

    await prisma.itemPedido.deleteMany({ where: { pedidoId: pedido.id } });
    await prisma.pedido.delete({ where: { id: pedido.id } });
    await prisma.cliente.delete({ where: { id: cliente.id } });
    await prisma.fabrica.delete({ where: { id: fabrica.id } });
  }, 15000);
});
