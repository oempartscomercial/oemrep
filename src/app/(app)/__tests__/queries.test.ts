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
      expect(resumo.fabricas.map((f) => f.id)).toEqual([fabricaA.id]);
    } finally {
      await prisma.pedido.deleteMany({ where: { id: { in: [pedidoA.id, pedidoB.id] } } });
      await prisma.cliente.delete({ where: { id: cliente.id } });
      await prisma.fabrica.deleteMany({ where: { id: { in: [fabricaA.id, fabricaB.id] } } });
    }
  }, 15000);

  it("usa o prazo da fábrica na fila e soma o que falta faturar", async () => {
    const agora = new Date();
    const cincoDiasAtras = new Date(agora.getTime() - 5 * 24 * 60 * 60 * 1000);
    const fabrica = await prisma.fabrica.create({ data: { nome: "Fábrica SLA Dashboard", cnpj: "83000000000004", slaDiasSemNota: 3 } });
    const cliente = await prisma.cliente.create({ data: { cnpj: "83000000000005", nomeFantasia: "Cliente SLA Dashboard" } });
    const pedido = await prisma.pedido.create({
      data: {
        numero: "PED-SLA-1",
        origem: "RAPIDO",
        fabricaId: fabrica.id,
        clienteId: cliente.id,
        dataPedido: cincoDiasAtras,
        valorTotalDeclarado: 1234.5,
      },
    });

    try {
      const operador = { id: "u1", nome: "Op", perfil: "OPERADOR" as const, fabricasIds: [fabrica.id] };
      const resumo = await buscarResumoDashboard(operador, agora);

      expect(resumo.kpis.semNota).toEqual({ quantidade: 1, valor: 1234.5 });
      expect(resumo.fabricas[0]).toMatchObject({ id: fabrica.id, aFaturar: 1234.5, pedidosAbertos: 1 });
      const alerta = resumo.fila.find((a) => a.href === `/pedidos/${pedido.id}`);
      expect(alerta).toMatchObject({ tipo: "SEM_NOTA", dias: 5, valor: 1234.5 });
      expect(alerta?.detalhe).toContain("prazo 3");
      expect(alerta?.detalhe).toContain("sem itens");
    } finally {
      await prisma.pedido.delete({ where: { id: pedido.id } });
      await prisma.cliente.delete({ where: { id: cliente.id } });
      await prisma.fabrica.delete({ where: { id: fabrica.id } });
    }
  }, 15000);
});
