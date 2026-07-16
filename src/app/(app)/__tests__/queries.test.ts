import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import { buscarResumoDashboard } from "../queries";

describe("buscarResumoDashboard", () => {
  it("conta pedidos ativos apenas da fábrica permitida", async () => {
    const fabricaA = await prisma.fabrica.create({ data: { nome: "Fábrica A DashboardQueries", cnpj: "83000000000001" } });
    const fabricaB = await prisma.fabrica.create({ data: { nome: "Fábrica B DashboardQueries", cnpj: "83000000000002" } });
    const cliente = await prisma.cliente.create({ data: { cnpj: "83000000000003", nomeFantasia: "Cliente Dashboard Queries" } });

    const pedidoA = await prisma.pedido.create({
      data: { numero: "PED-DA-1", origem: "MANUAL", fabricaId: fabricaA.id, clienteId: cliente.id },
    });
    const pedidoB = await prisma.pedido.create({
      data: { numero: "PED-DB-1", origem: "MANUAL", fabricaId: fabricaB.id, clienteId: cliente.id },
    });

    try {
      const operadorA = { id: "u1", nome: "Op A", perfil: "OPERADOR" as const, fabricasIds: [fabricaA.id] };

      const resumo = await buscarResumoDashboard(operadorA);

      expect(resumo.kpis.pedidosAtivos).toBe(1);
    } finally {
      await prisma.pedido.deleteMany({ where: { id: { in: [pedidoA.id, pedidoB.id] } } });
      await prisma.cliente.delete({ where: { id: cliente.id } });
      await prisma.fabrica.deleteMany({ where: { id: { in: [fabricaA.id, fabricaB.id] } } });
    }
  }, 15000);
});
