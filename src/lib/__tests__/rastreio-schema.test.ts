import { describe, it, expect } from "vitest";
import { prisma } from "../prisma";

describe("schema de EventoRastreio", () => {
  it("registra transições de rastreio de uma NFe e lê a timeline em ordem", async () => {
    const fabrica = await prisma.fabrica.create({
      data: { nome: "Fábrica Rastreio", cnpj: "44555666000188" },
    });
    const cliente = await prisma.cliente.create({
      data: { cnpj: "66555444000199", nomeFantasia: "Cliente Rastreio" },
    });
    const usuario = await prisma.usuario.create({
      data: { nome: "Op Rastreio", email: "rastreio-schema@teste.dev" },
    });
    const notaFiscal = await prisma.notaFiscal.create({
      data: {
        numero: "5678",
        chaveAcesso: "35260744555666000188550010000056781123456789",
        emitenteCnpj: fabrica.cnpj,
        destinatarioCnpj: cliente.cnpj,
        dataEmissao: new Date("2026-07-01T10:00:00-03:00"),
        totalProdutos: 100,
        totalNota: 110,
      },
    });

    await prisma.eventoRastreio.create({
      data: {
        notaFiscalId: notaFiscal.id,
        statusAnterior: "TRANSITO",
        status: "RECEBIDA",
        observacao: "Recebida na doca 3",
        dataEvento: new Date("2026-07-03T00:00:00-03:00"),
        usuarioId: usuario.id,
      },
    });
    await prisma.eventoRastreio.create({
      data: {
        notaFiscalId: notaFiscal.id,
        statusAnterior: "RECEBIDA",
        status: "ARMAZENADA",
        dataEvento: new Date("2026-07-04T00:00:00-03:00"),
        usuarioId: usuario.id,
      },
    });

    const timeline = await prisma.eventoRastreio.findMany({
      where: { notaFiscalId: notaFiscal.id },
      orderBy: { dataEvento: "asc" },
      include: { usuario: true },
    });

    expect(timeline).toHaveLength(2);
    expect(timeline[0].status).toBe("RECEBIDA");
    expect(timeline[0].statusAnterior).toBe("TRANSITO");
    expect(timeline[0].observacao).toBe("Recebida na doca 3");
    expect(timeline[0].usuario.nome).toBe("Op Rastreio");
    expect(timeline[1].status).toBe("ARMAZENADA");
    expect(timeline[1].observacao).toBeNull();

    await prisma.eventoRastreio.deleteMany({ where: { notaFiscalId: notaFiscal.id } });
    await prisma.notaFiscal.delete({ where: { id: notaFiscal.id } });
    await prisma.usuario.delete({ where: { id: usuario.id } });
    await prisma.cliente.delete({ where: { id: cliente.id } });
    await prisma.fabrica.delete({ where: { id: fabrica.id } });
  }, 15000);
});
