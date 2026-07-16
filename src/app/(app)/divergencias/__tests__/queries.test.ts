import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import { buscarChamadosPermitidos } from "../queries";

describe("buscarChamadosPermitidos — sinalização de crítico (RF29)", () => {
  it("marca como crítico o chamado sem evento há mais de 30 dias e o ordena primeiro", async () => {
    const fabrica = await prisma.fabrica.create({ data: { nome: "Fábrica Fila Crítica", cnpj: "90000000002177" } });
    const cliente = await prisma.cliente.create({ data: { cnpj: "90000000002258", nomeFantasia: "Cliente Fila Crítica" } });
    const usuario = await prisma.usuario.create({ data: { nome: "Analista Fila", email: "fila-critica@teste.dev" } });
    const pedido = await prisma.pedido.create({
      data: { numero: "PED-FILA-1", origem: "MANUAL", fabricaId: fabrica.id, clienteId: cliente.id },
    });
    const nota = await prisma.notaFiscal.create({
      data: {
        numero: "9303", chaveAcesso: "35260790000000002177550010000093031123456789",
        emitenteCnpj: fabrica.cnpj, destinatarioCnpj: cliente.cnpj,
        dataEmissao: new Date("2026-05-01T10:00:00-03:00"), totalProdutos: 50, totalNota: 55,
        pedidos: { create: [{ pedidoId: pedido.id }] },
      },
    });
    const motivo = await prisma.motivoChamado.create({ data: { nome: "Item quebrado (teste fila)" } });

    const chamadoAntigo = await prisma.chamado.create({
      data: {
        notaFiscalId: nota.id, motivoId: motivo.id, abertoPorId: usuario.id,
        eventos: { create: [{ estado: "ABERTO", estadoAnterior: null, observacao: "Aberto há muito tempo.", usuarioId: usuario.id }] },
      },
    });
    await prisma.eventoChamado.updateMany({
      where: { chamadoId: chamadoAntigo.id },
      data: { criadoEm: new Date("2026-05-01T00:00:00-03:00") },
    });

    const chamadoRecente = await prisma.chamado.create({
      data: {
        notaFiscalId: nota.id, motivoId: motivo.id, abertoPorId: usuario.id,
        eventos: { create: [{ estado: "ABERTO", estadoAnterior: null, observacao: "Aberto agora.", usuarioId: usuario.id }] },
      },
    });

    try {
      const usuarioSessao = { id: usuario.id, nome: usuario.nome, perfil: "ADMIN" as const, fabricasIds: [] };
      const chamados = await buscarChamadosPermitidos(usuarioSessao);
      const encontrados = chamados.filter((c) => [chamadoAntigo.id, chamadoRecente.id].includes(c.id));

      const antigo = encontrados.find((c) => c.id === chamadoAntigo.id);
      const recente = encontrados.find((c) => c.id === chamadoRecente.id);
      expect(antigo?.critico).toBe(true);
      expect(recente?.critico).toBe(false);

      const indiceAntigo = encontrados.findIndex((c) => c.id === chamadoAntigo.id);
      const indiceRecente = encontrados.findIndex((c) => c.id === chamadoRecente.id);
      expect(indiceAntigo).toBeLessThan(indiceRecente);
    } finally {
      await prisma.eventoChamado.deleteMany({ where: { chamadoId: { in: [chamadoAntigo.id, chamadoRecente.id] } } });
      await prisma.chamado.deleteMany({ where: { id: { in: [chamadoAntigo.id, chamadoRecente.id] } } });
      await prisma.motivoChamado.delete({ where: { id: motivo.id } });
      await prisma.notaFiscalPedido.deleteMany({ where: { notaFiscalId: nota.id } });
      await prisma.notaFiscal.delete({ where: { id: nota.id } });
      await prisma.pedido.delete({ where: { id: pedido.id } });
      await prisma.usuario.delete({ where: { id: usuario.id } });
      await prisma.cliente.delete({ where: { id: cliente.id } });
      await prisma.fabrica.delete({ where: { id: fabrica.id } });
    }
  }, 15000);
});
