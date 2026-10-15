import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import { buscarResumoDashboard, buscarSerieMensal } from "../queries";

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

describe("buscarSerieMensal", () => {
  it("soma por mês o histórico, os pedidos (itens ou valor declarado) e as NFes, só das fábricas permitidas", async () => {
    const fab = await prisma.fabrica.create({ data: { nome: "Fábrica Série", cnpj: "83000000000101" } });
    const outra = await prisma.fabrica.create({ data: { nome: "Outra Série", cnpj: "83000000000102" } });
    const cliente = await prisma.cliente.create({ data: { nomeFantasia: "Cliente Série" } });
    const ids: string[] = [];
    try {
      await prisma.historicoMensal.create({ data: { ano: 2001, mes: 3, fabricaId: fab.id, tipo: "PEDIDO", valor: 1000 } });
      await prisma.historicoMensal.create({ data: { ano: 2001, mes: 3, fabricaId: outra.id, tipo: "PEDIDO", valor: 9999 } });
      const comItens = await prisma.pedido.create({
        data: {
          numero: "SER-1", origem: "MANUAL", fabricaId: fab.id, clienteId: cliente.id, dataPedido: new Date("2001-04-10T12:00:00Z"),
          itens: { create: [{ referencia: "A", descricao: "a", quantidadePedida: 2, valorUnitario: 10.5 }, { referencia: "B", descricao: "b", quantidadePedida: 1, valorUnitario: 4 }] },
        },
      });
      const rapido = await prisma.pedido.create({
        data: { numero: "SER-2", origem: "RAPIDO", fabricaId: fab.id, clienteId: cliente.id, dataPedido: new Date("2001-04-20T12:00:00Z"), valorTotalDeclarado: 100 },
      });
      const deOutra = await prisma.pedido.create({
        data: { numero: "SER-3", origem: "RAPIDO", fabricaId: outra.id, clienteId: cliente.id, dataPedido: new Date("2001-04-20T12:00:00Z"), valorTotalDeclarado: 5000 },
      });
      ids.push(comItens.id, rapido.id, deOutra.id);
      const nota = await prisma.notaFiscal.create({
        data: { numero: "1", chaveAcesso: "8".repeat(44), emitenteCnpj: "1", destinatarioCnpj: "1", dataEmissao: new Date("2001-04-25T12:00:00Z"), totalProdutos: 20, totalNota: 25 },
      });
      await prisma.notaFiscalPedido.create({ data: { notaFiscalId: nota.id, pedidoId: comItens.id } });

      const operador = { id: "u1", nome: "Op", perfil: "OPERADOR" as const, fabricasIds: [fab.id] };
      const serie = (await buscarSerieMensal(operador)).filter((p) => p.mes.startsWith("2001-"));
      expect(serie).toEqual([
        { mes: "2001-03", valorPedido: 1000, valorNfe: 0 },
        { mes: "2001-04", valorPedido: 125, valorNfe: 25 },
      ]);
    } finally {
      await prisma.notaFiscalPedido.deleteMany({ where: { pedidoId: { in: ids } } });
      await prisma.notaFiscal.deleteMany({ where: { chaveAcesso: "8".repeat(44) } });
      await prisma.itemPedido.deleteMany({ where: { pedidoId: { in: ids } } });
      await prisma.pedido.deleteMany({ where: { id: { in: ids } } });
      await prisma.historicoMensal.deleteMany({ where: { fabricaId: { in: [fab.id, outra.id] } } });
      await prisma.cliente.delete({ where: { id: cliente.id } });
      await prisma.fabrica.deleteMany({ where: { id: { in: [fab.id, outra.id] } } });
    }
  }, 15000);
});
