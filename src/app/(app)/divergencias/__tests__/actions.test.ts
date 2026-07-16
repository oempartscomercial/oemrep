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
    let fabrica, cliente, pedido, nota, motivo;

    try {
      fabrica = await prisma.fabrica.create({ data: { nome: "Fábrica Chamado Action", cnpj: "90000000002175" } });
      cliente = await prisma.cliente.create({ data: { cnpj: "90000000002256", nomeFantasia: "Cliente Chamado Action" } });
      pedido = await prisma.pedido.create({
        data: {
          numero: "PED-CHACT-1",
          origem: "MANUAL",
          fabricaId: fabrica.id,
          clienteId: cliente.id,
          itens: { create: [{ referencia: "REF-A", descricao: "Item A", quantidadePedida: 5, valorUnitario: 10 }] },
        },
        include: { itens: true },
      });
      nota = await prisma.notaFiscal.create({
        data: {
          numero: "9301", chaveAcesso: "35260790000000002175550010000093011123456789",
          emitenteCnpj: fabrica.cnpj, destinatarioCnpj: cliente.cnpj,
          dataEmissao: new Date("2026-07-01T10:00:00-03:00"), totalProdutos: 50, totalNota: 55,
          pedidos: { create: [{ pedidoId: pedido.id }] },
          itensFaturados: { create: [{ itemPedidoId: pedido.itens[0].id, quantidadeFaturada: 5 }] },
        },
      });
      motivo = await prisma.motivoChamado.create({ data: { nome: "Extravio (teste ação)" } });

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
      if (motivo) await prisma.motivoChamado.delete({ where: { id: motivo.id } });
      if (nota) {
        await prisma.itemFaturado.deleteMany({ where: { notaFiscalId: nota.id } });
        await prisma.notaFiscalPedido.deleteMany({ where: { notaFiscalId: nota.id } });
        await prisma.notaFiscal.delete({ where: { id: nota.id } });
      }
      if (pedido) {
        await prisma.itemPedido.deleteMany({ where: { pedidoId: pedido.id } });
        await prisma.pedido.delete({ where: { id: pedido.id } });
      }
      if (cliente) await prisma.cliente.delete({ where: { id: cliente.id } });
      if (fabrica) await prisma.fabrica.delete({ where: { id: fabrica.id } });
    }
  }, 15000);

  it("cria o chamado, o ChamadoItem e o EventoChamado inicial quando o usuário tem permissão (RF25)", async () => {
    let fabrica, cliente, pedido, nota, motivo, usuario;

    try {
      fabrica = await prisma.fabrica.create({ data: { nome: "Fábrica Chamado OK", cnpj: "90000000002331" } });
      cliente = await prisma.cliente.create({ data: { cnpj: "90000000002412", nomeFantasia: "Cliente Chamado OK" } });
      pedido = await prisma.pedido.create({
        data: {
          numero: "PED-CHACT-2",
          origem: "MANUAL",
          fabricaId: fabrica.id,
          clienteId: cliente.id,
          itens: { create: [{ referencia: "REF-B", descricao: "Item B", quantidadePedida: 5, valorUnitario: 10 }] },
        },
        include: { itens: true },
      });
      nota = await prisma.notaFiscal.create({
        data: {
          numero: "9302", chaveAcesso: "35260790000000002331550010000093021123456789",
          emitenteCnpj: fabrica.cnpj, destinatarioCnpj: cliente.cnpj,
          dataEmissao: new Date("2026-07-01T10:00:00-03:00"), totalProdutos: 50, totalNota: 55,
          pedidos: { create: [{ pedidoId: pedido.id }] },
          itensFaturados: { create: [{ itemPedidoId: pedido.itens[0].id, quantidadeFaturada: 5 }] },
        },
      });
      motivo = await prisma.motivoChamado.create({ data: { nome: "Extravio (teste ação OK)" } });
      usuario = await prisma.usuario.create({
        data: { nome: "Operador Chamado OK", email: "chamado-action-ok@teste.dev" },
      });

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
      if (nota) {
        const chamados = await prisma.chamado.findMany({ where: { notaFiscalId: nota.id } });
        for (const c of chamados) {
          await prisma.eventoChamado.deleteMany({ where: { chamadoId: c.id } });
          await prisma.chamadoItem.deleteMany({ where: { chamadoId: c.id } });
          await prisma.chamado.delete({ where: { id: c.id } });
        }
      }
      if (motivo) await prisma.motivoChamado.delete({ where: { id: motivo.id } });
      if (nota) {
        await prisma.itemFaturado.deleteMany({ where: { notaFiscalId: nota.id } });
        await prisma.notaFiscalPedido.deleteMany({ where: { notaFiscalId: nota.id } });
        await prisma.notaFiscal.delete({ where: { id: nota.id } });
      }
      if (pedido) {
        await prisma.itemPedido.deleteMany({ where: { pedidoId: pedido.id } });
        await prisma.pedido.delete({ where: { id: pedido.id } });
      }
      if (usuario) await prisma.usuario.delete({ where: { id: usuario.id } });
      if (cliente) await prisma.cliente.delete({ where: { id: cliente.id } });
      if (fabrica) await prisma.fabrica.delete({ where: { id: fabrica.id } });
    }
  }, 15000);

  it("recusa abrir chamado quando um itemPedidoId submetido não pertence à NFe (itens faturados)", async () => {
    let fabrica, cliente, pedido, nota, pedidoAlheio, motivo;

    try {
      fabrica = await prisma.fabrica.create({ data: { nome: "Fábrica Chamado Alheio", cnpj: "90000000002587" } });
      cliente = await prisma.cliente.create({ data: { cnpj: "90000000002663", nomeFantasia: "Cliente Chamado Alheio" } });
      pedido = await prisma.pedido.create({
        data: {
          numero: "PED-CHACT-3",
          origem: "MANUAL",
          fabricaId: fabrica.id,
          clienteId: cliente.id,
          itens: { create: [{ referencia: "REF-C", descricao: "Item C", quantidadePedida: 5, valorUnitario: 10 }] },
        },
        include: { itens: true },
      });
      nota = await prisma.notaFiscal.create({
        data: {
          numero: "9303", chaveAcesso: "35260790000000002587550010000093031123456789",
          emitenteCnpj: fabrica.cnpj, destinatarioCnpj: cliente.cnpj,
          dataEmissao: new Date("2026-07-01T10:00:00-03:00"), totalProdutos: 50, totalNota: 55,
          pedidos: { create: [{ pedidoId: pedido.id }] },
          itensFaturados: { create: [{ itemPedidoId: pedido.itens[0].id, quantidadeFaturada: 5 }] },
        },
      });
      // Pedido/item completamente alheio à NFe acima — não está em itensFaturados.
      pedidoAlheio = await prisma.pedido.create({
        data: {
          numero: "PED-CHACT-ALHEIO",
          origem: "MANUAL",
          fabricaId: fabrica.id,
          clienteId: cliente.id,
          itens: { create: [{ referencia: "REF-D", descricao: "Item D", quantidadePedida: 3, valorUnitario: 20 }] },
        },
        include: { itens: true },
      });
      motivo = await prisma.motivoChamado.create({ data: { nome: "Extravio (teste ação alheio)" } });

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
      if (motivo) await prisma.motivoChamado.delete({ where: { id: motivo.id } });
      if (nota) {
        await prisma.itemFaturado.deleteMany({ where: { notaFiscalId: nota.id } });
        await prisma.notaFiscalPedido.deleteMany({ where: { notaFiscalId: nota.id } });
        await prisma.notaFiscal.delete({ where: { id: nota.id } });
      }
      if (pedidoAlheio) {
        await prisma.itemPedido.deleteMany({ where: { pedidoId: pedidoAlheio.id } });
        await prisma.pedido.delete({ where: { id: pedidoAlheio.id } });
      }
      if (pedido) {
        await prisma.itemPedido.deleteMany({ where: { pedidoId: pedido.id } });
        await prisma.pedido.delete({ where: { id: pedido.id } });
      }
      if (cliente) await prisma.cliente.delete({ where: { id: cliente.id } });
      if (fabrica) await prisma.fabrica.delete({ where: { id: fabrica.id } });
    }
  }, 15000);
});

describe("registrarEventoChamado — autorização por fábrica (ADR-009)", () => {
  it("recusa registrar andamento quando o usuário não tem permissão na fábrica da NFe", async () => {
    let fabrica, cliente, usuarioAbertura, pedido, nota, motivo, chamado;

    try {
      fabrica = await prisma.fabrica.create({ data: { nome: "Fábrica Chamado Evento", cnpj: "90000000002176" } });
      cliente = await prisma.cliente.create({ data: { cnpj: "90000000002257", nomeFantasia: "Cliente Chamado Evento" } });
      usuarioAbertura = await prisma.usuario.create({ data: { nome: "Abertura", email: "chamado-evento-abertura@teste.dev" } });
      pedido = await prisma.pedido.create({
        data: { numero: "PED-CHEV-1", origem: "MANUAL", fabricaId: fabrica.id, clienteId: cliente.id },
      });
      nota = await prisma.notaFiscal.create({
        data: {
          numero: "9302", chaveAcesso: "35260790000000002176550010000093021123456789",
          emitenteCnpj: fabrica.cnpj, destinatarioCnpj: cliente.cnpj,
          dataEmissao: new Date("2026-07-01T10:00:00-03:00"), totalProdutos: 50, totalNota: 55,
          pedidos: { create: [{ pedidoId: pedido.id }] },
        },
      });
      motivo = await prisma.motivoChamado.create({ data: { nome: "Item faltando (teste evento)" } });
      chamado = await prisma.chamado.create({
        data: {
          notaFiscalId: nota.id,
          motivoId: motivo.id,
          abertoPorId: usuarioAbertura.id,
          eventos: { create: [{ estado: "ABERTO", estadoAnterior: null, observacao: "Faltou item.", usuarioId: usuarioAbertura.id }] },
        },
      });

      obterUsuarioLogadoMock.mockResolvedValue({ id: "u2", nome: "Op2", perfil: "OPERADOR", fabricasIds: ["outra"] });

      const resultado = await registrarEventoChamado(chamado.id, "EM_TRATATIVA", "Assumindo o caso.");

      expect(resultado.erros).toEqual(["Você não tem permissão para atualizar este chamado."]);

      const chamadoInalterado = await prisma.chamado.findUnique({ where: { id: chamado.id } });
      expect(chamadoInalterado?.estado).toBe("ABERTO");

      const eventos = await prisma.eventoChamado.findMany({ where: { chamadoId: chamado.id } });
      expect(eventos).toHaveLength(1);
    } finally {
      if (chamado) {
        await prisma.eventoChamado.deleteMany({ where: { chamadoId: chamado.id } });
        await prisma.chamado.delete({ where: { id: chamado.id } });
      }
      if (motivo) await prisma.motivoChamado.delete({ where: { id: motivo.id } });
      if (nota) {
        await prisma.notaFiscalPedido.deleteMany({ where: { notaFiscalId: nota.id } });
        await prisma.notaFiscal.delete({ where: { id: nota.id } });
      }
      if (pedido) await prisma.pedido.delete({ where: { id: pedido.id } });
      if (usuarioAbertura) await prisma.usuario.delete({ where: { id: usuarioAbertura.id } });
      if (cliente) await prisma.cliente.delete({ where: { id: cliente.id } });
      if (fabrica) await prisma.fabrica.delete({ where: { id: fabrica.id } });
    }
  }, 15000);

  it("registra o andamento e atualiza o estado do chamado quando o usuário tem permissão (RF25/RF30)", async () => {
    let fabrica, cliente, usuarioAbertura, usuarioTratativa, pedido, nota, motivo, chamado;

    try {
      fabrica = await prisma.fabrica.create({ data: { nome: "Fábrica Chamado Evento OK", cnpj: "90000000002337" } });
      cliente = await prisma.cliente.create({ data: { cnpj: "90000000002418", nomeFantasia: "Cliente Chamado Evento OK" } });
      usuarioAbertura = await prisma.usuario.create({ data: { nome: "Abertura OK", email: "chamado-evento-abertura-ok@teste.dev" } });
      usuarioTratativa = await prisma.usuario.create({ data: { nome: "Tratativa OK", email: "chamado-evento-tratativa-ok@teste.dev" } });
      pedido = await prisma.pedido.create({
        data: { numero: "PED-CHEV-2", origem: "MANUAL", fabricaId: fabrica.id, clienteId: cliente.id },
      });
      nota = await prisma.notaFiscal.create({
        data: {
          numero: "9304", chaveAcesso: "35260790000000002337550010000093041123456789",
          emitenteCnpj: fabrica.cnpj, destinatarioCnpj: cliente.cnpj,
          dataEmissao: new Date("2026-07-01T10:00:00-03:00"), totalProdutos: 50, totalNota: 55,
          pedidos: { create: [{ pedidoId: pedido.id }] },
        },
      });
      motivo = await prisma.motivoChamado.create({ data: { nome: "Item faltando (teste evento OK)" } });
      chamado = await prisma.chamado.create({
        data: {
          notaFiscalId: nota.id,
          motivoId: motivo.id,
          abertoPorId: usuarioAbertura.id,
          eventos: { create: [{ estado: "ABERTO", estadoAnterior: null, observacao: "Faltou item.", usuarioId: usuarioAbertura.id }] },
        },
      });

      obterUsuarioLogadoMock.mockResolvedValue({
        id: usuarioTratativa.id,
        nome: "Tratativa OK",
        perfil: "OPERADOR",
        fabricasIds: [fabrica.id],
      });

      const resultado = await registrarEventoChamado(chamado.id, "EM_TRATATIVA", "Assumindo o caso.");

      expect(resultado.erros).toEqual([]);

      const chamadoAtualizado = await prisma.chamado.findUnique({ where: { id: chamado.id } });
      expect(chamadoAtualizado?.estado).toBe("EM_TRATATIVA");

      const eventos = await prisma.eventoChamado.findMany({
        where: { chamadoId: chamado.id },
        orderBy: { criadoEm: "asc" },
      });
      expect(eventos).toHaveLength(2);
      const eventoNovo = eventos[1];
      expect(eventoNovo.estadoAnterior).toBe("ABERTO");
      expect(eventoNovo.estado).toBe("EM_TRATATIVA");
      expect(eventoNovo.observacao).toBe("Assumindo o caso.");
    } finally {
      if (chamado) {
        await prisma.eventoChamado.deleteMany({ where: { chamadoId: chamado.id } });
        await prisma.chamado.delete({ where: { id: chamado.id } });
      }
      if (motivo) await prisma.motivoChamado.delete({ where: { id: motivo.id } });
      if (nota) {
        await prisma.notaFiscalPedido.deleteMany({ where: { notaFiscalId: nota.id } });
        await prisma.notaFiscal.delete({ where: { id: nota.id } });
      }
      if (pedido) await prisma.pedido.delete({ where: { id: pedido.id } });
      if (usuarioTratativa) await prisma.usuario.delete({ where: { id: usuarioTratativa.id } });
      if (usuarioAbertura) await prisma.usuario.delete({ where: { id: usuarioAbertura.id } });
      if (cliente) await prisma.cliente.delete({ where: { id: cliente.id } });
      if (fabrica) await prisma.fabrica.delete({ where: { id: fabrica.id } });
    }
  }, 15000);
});
