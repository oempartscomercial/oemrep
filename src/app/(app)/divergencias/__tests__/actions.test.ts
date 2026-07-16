import { describe, it, expect, vi } from "vitest";
import { prisma } from "@/lib/prisma";

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const obterUsuarioLogadoMock = vi.fn();
vi.mock("@/lib/sessao", () => ({
  obterUsuarioLogado: () => obterUsuarioLogadoMock(),
}));

import { abrirChamado, registrarEventoChamado } from "../actions";

describe("abrirChamado — autorização por fábrica (ADR-009) e regras (RF25/RF30)", () => {
  it("recusa abrir chamado quando o usuário não tem permissão na fábrica da NFe", async () => {
    const fabrica = await prisma.fabrica.create({ data: { nome: "Fábrica Chamado Action", cnpj: "90000000002175" } });
    const cliente = await prisma.cliente.create({ data: { cnpj: "90000000002256", nomeFantasia: "Cliente Chamado Action" } });
    const pedido = await prisma.pedido.create({
      data: {
        numero: "PED-CHACT-1",
        origem: "MANUAL",
        fabricaId: fabrica.id,
        clienteId: cliente.id,
        itens: { create: [{ referencia: "REF-A", descricao: "Item A", quantidadePedida: 5, valorUnitario: 10 }] },
      },
      include: { itens: true },
    });
    const nota = await prisma.notaFiscal.create({
      data: {
        numero: "9301", chaveAcesso: "35260790000000002175550010000093011123456789",
        emitenteCnpj: fabrica.cnpj, destinatarioCnpj: cliente.cnpj,
        dataEmissao: new Date("2026-07-01T10:00:00-03:00"), totalProdutos: 50, totalNota: 55,
        pedidos: { create: [{ pedidoId: pedido.id }] },
        itensFaturados: { create: [{ itemPedidoId: pedido.itens[0].id, quantidadeFaturada: 5 }] },
      },
    });
    const motivo = await prisma.motivoChamado.create({ data: { nome: "Extravio (teste ação)" } });

    try {
      obterUsuarioLogadoMock.mockResolvedValue({ id: "u1", nome: "Op", perfil: "OPERADOR", fabricasIds: ["outra"] });

      const formData = new FormData();
      formData.set("notaFiscalId", nota.id);
      formData.set("motivoId", motivo.id);
      formData.set("observacao", "Nota extraviada no transporte.");
      formData.append("itemPedidoId", pedido.itens[0].id);

      const resultado = await abrirChamado(formData);

      expect(resultado.erros).toEqual(["Você não tem permissão para abrir chamados para esta NFe."]);

      const chamados = await prisma.chamado.findMany({ where: { notaFiscalId: nota.id } });
      expect(chamados).toHaveLength(0);
    } finally {
      await prisma.motivoChamado.delete({ where: { id: motivo.id } });
      await prisma.itemFaturado.deleteMany({ where: { notaFiscalId: nota.id } });
      await prisma.notaFiscalPedido.deleteMany({ where: { notaFiscalId: nota.id } });
      await prisma.notaFiscal.delete({ where: { id: nota.id } });
      await prisma.itemPedido.deleteMany({ where: { pedidoId: pedido.id } });
      await prisma.pedido.delete({ where: { id: pedido.id } });
      await prisma.cliente.delete({ where: { id: cliente.id } });
      await prisma.fabrica.delete({ where: { id: fabrica.id } });
    }
  }, 15000);

  it("cria o chamado, o ChamadoItem e o EventoChamado inicial quando o usuário tem permissão (RF25)", async () => {
    const fabrica = await prisma.fabrica.create({ data: { nome: "Fábrica Chamado OK", cnpj: "90000000002331" } });
    const cliente = await prisma.cliente.create({ data: { cnpj: "90000000002412", nomeFantasia: "Cliente Chamado OK" } });
    const pedido = await prisma.pedido.create({
      data: {
        numero: "PED-CHACT-2",
        origem: "MANUAL",
        fabricaId: fabrica.id,
        clienteId: cliente.id,
        itens: { create: [{ referencia: "REF-B", descricao: "Item B", quantidadePedida: 5, valorUnitario: 10 }] },
      },
      include: { itens: true },
    });
    const nota = await prisma.notaFiscal.create({
      data: {
        numero: "9302", chaveAcesso: "35260790000000002331550010000093021123456789",
        emitenteCnpj: fabrica.cnpj, destinatarioCnpj: cliente.cnpj,
        dataEmissao: new Date("2026-07-01T10:00:00-03:00"), totalProdutos: 50, totalNota: 55,
        pedidos: { create: [{ pedidoId: pedido.id }] },
        itensFaturados: { create: [{ itemPedidoId: pedido.itens[0].id, quantidadeFaturada: 5 }] },
      },
    });
    const motivo = await prisma.motivoChamado.create({ data: { nome: "Extravio (teste ação OK)" } });
    const usuario = await prisma.usuario.create({
      data: { nome: "Operador Chamado OK", email: "chamado-action-ok@teste.dev" },
    });

    try {
      obterUsuarioLogadoMock.mockResolvedValue({ id: usuario.id, nome: "Op", perfil: "OPERADOR", fabricasIds: [fabrica.id] });

      const formData = new FormData();
      formData.set("notaFiscalId", nota.id);
      formData.set("motivoId", motivo.id);
      formData.set("observacao", "Nota extraviada no transporte.");
      formData.append("itemPedidoId", pedido.itens[0].id);

      const resultado = await abrirChamado(formData);

      expect(resultado.erros).toEqual([]);
      expect(resultado.chamadoId).toBeDefined();

      const chamado = await prisma.chamado.findUnique({
        where: { id: resultado.chamadoId },
        include: { itensAfetados: true, eventos: true },
      });
      expect(chamado).not.toBeNull();
      expect(chamado?.notaFiscalId).toBe(nota.id);
      expect(chamado?.motivoId).toBe(motivo.id);
      expect(chamado?.itensAfetados).toHaveLength(1);
      expect(chamado?.itensAfetados[0].itemPedidoId).toBe(pedido.itens[0].id);
      expect(chamado?.eventos).toHaveLength(1);
      expect(chamado?.eventos[0].estadoAnterior).toBeNull();
      expect(chamado?.eventos[0].estado).toBe("ABERTO");
    } finally {
      const chamados = await prisma.chamado.findMany({ where: { notaFiscalId: nota.id } });
      for (const c of chamados) {
        await prisma.eventoChamado.deleteMany({ where: { chamadoId: c.id } });
        await prisma.chamadoItem.deleteMany({ where: { chamadoId: c.id } });
        await prisma.chamado.delete({ where: { id: c.id } });
      }
      await prisma.motivoChamado.delete({ where: { id: motivo.id } });
      await prisma.itemFaturado.deleteMany({ where: { notaFiscalId: nota.id } });
      await prisma.notaFiscalPedido.deleteMany({ where: { notaFiscalId: nota.id } });
      await prisma.notaFiscal.delete({ where: { id: nota.id } });
      await prisma.itemPedido.deleteMany({ where: { pedidoId: pedido.id } });
      await prisma.pedido.delete({ where: { id: pedido.id } });
      await prisma.usuario.delete({ where: { id: usuario.id } });
      await prisma.cliente.delete({ where: { id: cliente.id } });
      await prisma.fabrica.delete({ where: { id: fabrica.id } });
    }
  }, 15000);

  it("recusa abrir chamado quando um itemPedidoId submetido não pertence à NFe (itens faturados)", async () => {
    const fabrica = await prisma.fabrica.create({ data: { nome: "Fábrica Chamado Alheio", cnpj: "90000000002587" } });
    const cliente = await prisma.cliente.create({ data: { cnpj: "90000000002663", nomeFantasia: "Cliente Chamado Alheio" } });
    const pedido = await prisma.pedido.create({
      data: {
        numero: "PED-CHACT-3",
        origem: "MANUAL",
        fabricaId: fabrica.id,
        clienteId: cliente.id,
        itens: { create: [{ referencia: "REF-C", descricao: "Item C", quantidadePedida: 5, valorUnitario: 10 }] },
      },
      include: { itens: true },
    });
    const nota = await prisma.notaFiscal.create({
      data: {
        numero: "9303", chaveAcesso: "35260790000000002587550010000093031123456789",
        emitenteCnpj: fabrica.cnpj, destinatarioCnpj: cliente.cnpj,
        dataEmissao: new Date("2026-07-01T10:00:00-03:00"), totalProdutos: 50, totalNota: 55,
        pedidos: { create: [{ pedidoId: pedido.id }] },
        itensFaturados: { create: [{ itemPedidoId: pedido.itens[0].id, quantidadeFaturada: 5 }] },
      },
    });
    // Pedido/item completamente alheio à NFe acima — não está em itensFaturados.
    const pedidoAlheio = await prisma.pedido.create({
      data: {
        numero: "PED-CHACT-ALHEIO",
        origem: "MANUAL",
        fabricaId: fabrica.id,
        clienteId: cliente.id,
        itens: { create: [{ referencia: "REF-D", descricao: "Item D", quantidadePedida: 3, valorUnitario: 20 }] },
      },
      include: { itens: true },
    });
    const motivo = await prisma.motivoChamado.create({ data: { nome: "Extravio (teste ação alheio)" } });

    try {
      obterUsuarioLogadoMock.mockResolvedValue({ id: "u1", nome: "Op", perfil: "OPERADOR", fabricasIds: [fabrica.id] });

      const formData = new FormData();
      formData.set("notaFiscalId", nota.id);
      formData.set("motivoId", motivo.id);
      formData.set("observacao", "Nota extraviada no transporte.");
      formData.append("itemPedidoId", pedidoAlheio.itens[0].id);

      const resultado = await abrirChamado(formData);

      expect(resultado.erros).toEqual(["Um ou mais itens selecionados não pertencem a esta NFe."]);

      const chamados = await prisma.chamado.findMany({ where: { notaFiscalId: nota.id } });
      expect(chamados).toHaveLength(0);
    } finally {
      await prisma.motivoChamado.delete({ where: { id: motivo.id } });
      await prisma.itemFaturado.deleteMany({ where: { notaFiscalId: nota.id } });
      await prisma.notaFiscalPedido.deleteMany({ where: { notaFiscalId: nota.id } });
      await prisma.notaFiscal.delete({ where: { id: nota.id } });
      await prisma.itemPedido.deleteMany({ where: { pedidoId: pedidoAlheio.id } });
      await prisma.pedido.delete({ where: { id: pedidoAlheio.id } });
      await prisma.itemPedido.deleteMany({ where: { pedidoId: pedido.id } });
      await prisma.pedido.delete({ where: { id: pedido.id } });
      await prisma.cliente.delete({ where: { id: cliente.id } });
      await prisma.fabrica.delete({ where: { id: fabrica.id } });
    }
  }, 15000);
});

describe("registrarEventoChamado — autorização por fábrica (ADR-009)", () => {
  it("recusa registrar andamento quando o usuário não tem permissão na fábrica da NFe", async () => {
    const fabrica = await prisma.fabrica.create({ data: { nome: "Fábrica Chamado Evento", cnpj: "90000000002176" } });
    const cliente = await prisma.cliente.create({ data: { cnpj: "90000000002257", nomeFantasia: "Cliente Chamado Evento" } });
    const usuarioAbertura = await prisma.usuario.create({ data: { nome: "Abertura", email: "chamado-evento-abertura@teste.dev" } });
    const pedido = await prisma.pedido.create({
      data: { numero: "PED-CHEV-1", origem: "MANUAL", fabricaId: fabrica.id, clienteId: cliente.id },
    });
    const nota = await prisma.notaFiscal.create({
      data: {
        numero: "9302", chaveAcesso: "35260790000000002176550010000093021123456789",
        emitenteCnpj: fabrica.cnpj, destinatarioCnpj: cliente.cnpj,
        dataEmissao: new Date("2026-07-01T10:00:00-03:00"), totalProdutos: 50, totalNota: 55,
        pedidos: { create: [{ pedidoId: pedido.id }] },
      },
    });
    const motivo = await prisma.motivoChamado.create({ data: { nome: "Item faltando (teste evento)" } });
    const chamado = await prisma.chamado.create({
      data: {
        notaFiscalId: nota.id,
        motivoId: motivo.id,
        abertoPorId: usuarioAbertura.id,
        eventos: { create: [{ estado: "ABERTO", estadoAnterior: null, observacao: "Faltou item.", usuarioId: usuarioAbertura.id }] },
      },
    });

    try {
      obterUsuarioLogadoMock.mockResolvedValue({ id: "u2", nome: "Op2", perfil: "OPERADOR", fabricasIds: ["outra"] });

      const resultado = await registrarEventoChamado(chamado.id, "EM_TRATATIVA", "Assumindo o caso.");

      expect(resultado.erros).toEqual(["Você não tem permissão para atualizar este chamado."]);

      const chamadoInalterado = await prisma.chamado.findUnique({ where: { id: chamado.id } });
      expect(chamadoInalterado?.estado).toBe("ABERTO");

      const eventos = await prisma.eventoChamado.findMany({ where: { chamadoId: chamado.id } });
      expect(eventos).toHaveLength(1);
    } finally {
      await prisma.eventoChamado.deleteMany({ where: { chamadoId: chamado.id } });
      await prisma.chamado.delete({ where: { id: chamado.id } });
      await prisma.motivoChamado.delete({ where: { id: motivo.id } });
      await prisma.notaFiscalPedido.deleteMany({ where: { notaFiscalId: nota.id } });
      await prisma.notaFiscal.delete({ where: { id: nota.id } });
      await prisma.pedido.delete({ where: { id: pedido.id } });
      await prisma.usuario.delete({ where: { id: usuarioAbertura.id } });
      await prisma.cliente.delete({ where: { id: cliente.id } });
      await prisma.fabrica.delete({ where: { id: fabrica.id } });
    }
  }, 15000);
});
