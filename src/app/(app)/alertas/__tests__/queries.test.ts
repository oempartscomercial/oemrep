import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import { buscarPedidosParaAlerta } from "../queries";

describe("buscarPedidosParaAlerta", () => {
  it("filtra pedidos pela fábrica do usuário", async () => {
    const fabricaA = await prisma.fabrica.create({ data: { nome: "Fábrica A AlertaQueries", cnpj: "82000000000001" } });
    const fabricaB = await prisma.fabrica.create({ data: { nome: "Fábrica B AlertaQueries", cnpj: "82000000000002" } });
    const cliente = await prisma.cliente.create({ data: { cnpj: "82000000000003", nomeFantasia: "Cliente Alerta Queries" } });

    const pedidoA = await prisma.pedido.create({
      data: { numero: "PED-AA-1", origem: "MANUAL", fabricaId: fabricaA.id, clienteId: cliente.id },
    });
    const pedidoB = await prisma.pedido.create({
      data: { numero: "PED-AB-1", origem: "MANUAL", fabricaId: fabricaB.id, clienteId: cliente.id },
    });

    try {
      const operadorA = { id: "u1", nome: "Op A", perfil: "OPERADOR" as const, fabricasIds: [fabricaA.id] };

      const lista = await buscarPedidosParaAlerta(operadorA);

      expect(lista.some((p) => p.fabrica === fabricaA.nome)).toBe(true);
      expect(lista.some((p) => p.fabrica === fabricaB.nome)).toBe(false);
    } finally {
      await prisma.pedido.deleteMany({ where: { id: { in: [pedidoA.id, pedidoB.id] } } });
      await prisma.cliente.delete({ where: { id: cliente.id } });
      await prisma.fabrica.deleteMany({ where: { id: { in: [fabricaA.id, fabricaB.id] } } });
    }
  }, 15000);
});
