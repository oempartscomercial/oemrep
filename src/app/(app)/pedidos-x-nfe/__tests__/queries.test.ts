import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import { buscarPedidosParaGap } from "../queries";

describe("buscarPedidosParaGap", () => {
  it("filtra pedidos pela fábrica do usuário", async () => {
    const fabricaA = await prisma.fabrica.create({ data: { nome: "Fábrica A GapQueries", cnpj: "81000000000001" } });
    const fabricaB = await prisma.fabrica.create({ data: { nome: "Fábrica B GapQueries", cnpj: "81000000000002" } });
    const cliente = await prisma.cliente.create({ data: { cnpj: "81000000000003", nomeFantasia: "Cliente Gap Queries" } });

    const pedidoA = await prisma.pedido.create({
      data: {
        numero: "PED-GA-1", origem: "MANUAL", fabricaId: fabricaA.id, clienteId: cliente.id,
        itens: { create: [{ referencia: "REF-A", descricao: "Item A", quantidadePedida: 10, valorUnitario: 5 }] },
      },
    });
    const pedidoB = await prisma.pedido.create({
      data: {
        numero: "PED-GB-1", origem: "MANUAL", fabricaId: fabricaB.id, clienteId: cliente.id,
        itens: { create: [{ referencia: "REF-B", descricao: "Item B", quantidadePedida: 10, valorUnitario: 5 }] },
      },
    });

    try {
      const operadorA = { id: "u1", nome: "Op A", perfil: "OPERADOR" as const, fabricasIds: [fabricaA.id] };

      const lista = await buscarPedidosParaGap(operadorA);

      expect(lista.some((p) => p.fabrica === fabricaA.nome)).toBe(true);
      expect(lista.some((p) => p.fabrica === fabricaB.nome)).toBe(false);
    } finally {
      await prisma.itemPedido.deleteMany({ where: { pedidoId: { in: [pedidoA.id, pedidoB.id] } } });
      await prisma.pedido.deleteMany({ where: { id: { in: [pedidoA.id, pedidoB.id] } } });
      await prisma.cliente.delete({ where: { id: cliente.id } });
      await prisma.fabrica.deleteMany({ where: { id: { in: [fabricaA.id, fabricaB.id] } } });
    }
  }, 15000);
});
