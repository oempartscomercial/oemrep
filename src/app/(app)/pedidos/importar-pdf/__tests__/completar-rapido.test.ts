import { describe, it, expect, vi } from "vitest";
import { prisma } from "@/lib/prisma";

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const obterUsuarioLogadoMock = vi.fn();
vi.mock("@/lib/sessao", () => ({
  obterUsuarioLogado: () => obterUsuarioLogadoMock(),
}));

import { acharPedidoRapidoParecido, confirmarImportacaoPdf } from "../actions";

const CNPJ_FABRICA = "73100004000115";
const CNPJ_CLIENTE = "73100005000160";
const CNPJ_OUTRO_CLIENTE = "73100006000104";
const DATA_RAPIDO = new Date("2026-10-05T12:00:00-03:00");

const item = { referencia: "40150270", descricao: "Cabo", quantidade: 40, valorUnitario: 205.569 };

async function cenario() {
  const fabrica = await prisma.fabrica.create({ data: { nome: "Fábrica Completar Teste", cnpj: CNPJ_FABRICA } });
  const cliente = await prisma.cliente.create({ data: { cnpj: CNPJ_CLIENTE, nomeFantasia: "Cliente Completar Teste" } });
  const outroCliente = await prisma.cliente.create({ data: { cnpj: CNPJ_OUTRO_CLIENTE, nomeFantasia: "Outro Cliente Completar" } });
  const usuario = await prisma.usuario.create({ data: { nome: "Op Completar", email: "completar-rapido@teste.dev" } });
  const arquivo = await prisma.arquivoImportado.create({
    data: {
      nomeOriginal: "pedido-completar.pdf",
      caminhoStorage: `teste/completar-rapido-${CNPJ_FABRICA}.pdf`,
      tamanhoBytes: 1234,
      mimeType: "application/pdf",
      enviadoPorId: usuario.id,
    },
  });
  const importacao = await prisma.importacaoPedido.create({
    data: { arquivoId: arquivo.id, estado: "AGUARDANDO_REVISAO", criadoPorId: usuario.id, fabricaId: fabrica.id, clienteId: cliente.id },
  });
  return { fabrica, cliente, outroCliente, usuario, arquivo, importacao };
}

// Pedido rápido de teste: só cliente, valor e número, sem itens nem nota (como o formulário grava).
function criarRapido(c: Awaited<ReturnType<typeof cenario>>, dados: { numero: string; valor: number; clienteId?: string }) {
  return prisma.pedido.create({
    data: {
      numero: dados.numero,
      origem: "RAPIDO",
      fabricaId: c.fabrica.id,
      clienteId: dados.clienteId ?? c.cliente.id,
      valorTotalDeclarado: dados.valor,
      dataPedido: DATA_RAPIDO,
    },
  });
}

async function limpar(c: Awaited<ReturnType<typeof cenario>>) {
  const pedidos = await prisma.pedido.findMany({ where: { fabricaId: c.fabrica.id }, select: { id: true } });
  await prisma.eventoAuditoria.deleteMany({ where: { usuarioId: c.usuario.id } });
  await prisma.importacaoPedido.deleteMany({ where: { criadoPorId: c.usuario.id } });
  await prisma.itemPedido.deleteMany({ where: { pedidoId: { in: pedidos.map((p) => p.id) } } });
  await prisma.pedido.deleteMany({ where: { fabricaId: c.fabrica.id } });
  await prisma.arquivoImportado.deleteMany({ where: { id: c.arquivo.id } });
  await prisma.usuario.deleteMany({ where: { id: c.usuario.id } });
  const clienteIds = [c.cliente.id, c.outroCliente.id];
  await prisma.clienteFabrica.deleteMany({ where: { clienteId: { in: clienteIds } } });
  await prisma.cliente.deleteMany({ where: { id: { in: clienteIds } } });
  await prisma.fabrica.deleteMany({ where: { id: c.fabrica.id } });
}

describe("acharPedidoRapidoParecido", () => {
  it("acha o pedido rápido do mesmo cliente pelo mesmo número, e não o de outro cliente", async () => {
    const c = await cenario();
    try {
      const rapido = await criarRapido(c, { numero: "P-7001", valor: 4050 });
      await criarRapido(c, { numero: "P-7002", valor: 777, clienteId: c.outroCliente.id });

      const achado = await acharPedidoRapidoParecido(c.fabrica.id, c.cliente.id, 9999, "P-7001");
      expect(achado).toMatchObject({ id: rapido.id, numero: "P-7001", valor: 4050 });

      expect(await acharPedidoRapidoParecido(c.fabrica.id, c.cliente.id, 777, "P-7002")).toBeNull();
    } finally {
      await limpar(c);
    }
  }, 15000);

  it("acha pelo valor com até 1% de diferença, e não acha com diferença maior", async () => {
    const c = await cenario();
    try {
      const rapido = await criarRapido(c, { numero: "P-7100", valor: 10000 });

      // 10.080 está 0,79% acima de 10.000: dentro da margem de 1%.
      expect((await acharPedidoRapidoParecido(c.fabrica.id, c.cliente.id, 10080, "OUTRO-NUM"))?.id).toBe(rapido.id);
      // 10.300 está 2,9% acima: fora da margem.
      expect(await acharPedidoRapidoParecido(c.fabrica.id, c.cliente.id, 10300, "OUTRO-NUM")).toBeNull();
    } finally {
      await limpar(c);
    }
  }, 15000);

  it("ignora pedido rápido que já tem itens, mesmo com o mesmo número", async () => {
    const c = await cenario();
    try {
      const rapido = await criarRapido(c, { numero: "P-7200", valor: 500 });
      await prisma.itemPedido.create({
        data: { pedidoId: rapido.id, referencia: "REF-1", descricao: "Peça", quantidadePedida: 1, valorUnitario: 500 },
      });

      expect(await acharPedidoRapidoParecido(c.fabrica.id, c.cliente.id, 500, "P-7200")).toBeNull();
    } finally {
      await limpar(c);
    }
  }, 15000);
});

describe("confirmarImportacaoPdf — completar pedido rápido (completarPedidoId)", () => {
  it("adiciona os itens ao MESMO pedido rápido, sem criar outro, com origem PDF e nº do cliente", async () => {
    const c = await cenario();
    try {
      obterUsuarioLogadoMock.mockResolvedValue({ id: c.usuario.id, nome: "Op", perfil: "ADMIN", fabricasIds: [] });
      const rapido = await criarRapido(c, { numero: "P-7300", valor: 8222.76 });

      const r = await confirmarImportacaoPdf({
        importacaoId: c.importacao.id,
        fabricaId: c.fabrica.id,
        clienteId: c.cliente.id,
        numero: "P-7300",
        semNumero: false,
        itens: [item],
        numeroCliente: "OC-5530",
        completarPedidoId: rapido.id,
      });

      expect(r).toEqual({ erros: [], pedidoId: rapido.id });
      expect(await prisma.pedido.count({ where: { fabricaId: c.fabrica.id } })).toBe(1);

      const pedido = await prisma.pedido.findUniqueOrThrow({ where: { id: rapido.id }, include: { itens: true } });
      expect(pedido).toMatchObject({ origem: "PDF", numeroCliente: "OC-5530", arquivoOrigemId: c.arquivo.id });
      expect(pedido.itens).toHaveLength(1);
      expect(pedido.itens[0]).toMatchObject({ referencia: "40150270", quantidadePedida: 40 });
      expect(Number(pedido.itens[0].valorUnitario)).toBe(205.569);

      const importacao = await prisma.importacaoPedido.findUniqueOrThrow({ where: { id: c.importacao.id } });
      expect(importacao).toMatchObject({ estado: "CONFIRMADA", pedidoId: rapido.id });

      const auditoria = await prisma.eventoAuditoria.findMany({
        where: { entidade: "Pedido", entidadeId: rapido.id, campo: "completouPedidoRapido" },
      });
      expect(auditoria).toHaveLength(1);
    } finally {
      await limpar(c);
    }
  }, 15000);

  it("recusa completar um pedido rápido de outro cliente e não grava nada", async () => {
    const c = await cenario();
    try {
      obterUsuarioLogadoMock.mockResolvedValue({ id: c.usuario.id, nome: "Op", perfil: "ADMIN", fabricasIds: [] });
      const deOutro = await criarRapido(c, { numero: "P-7400", valor: 100, clienteId: c.outroCliente.id });

      const r = await confirmarImportacaoPdf({
        importacaoId: c.importacao.id,
        fabricaId: c.fabrica.id,
        clienteId: c.cliente.id,
        numero: "P-7400",
        semNumero: false,
        itens: [item],
        completarPedidoId: deOutro.id,
      });

      expect(r.erros).toEqual(["O pedido rápido a completar não é desta fábrica e cliente. Recarregue a página."]);
      const pedido = await prisma.pedido.findUniqueOrThrow({ where: { id: deOutro.id }, include: { itens: true } });
      expect(pedido.origem).toBe("RAPIDO");
      expect(pedido.itens).toHaveLength(0);
      expect((await prisma.importacaoPedido.findUniqueOrThrow({ where: { id: c.importacao.id } })).estado).toBe("AGUARDANDO_REVISAO");
    } finally {
      await limpar(c);
    }
  }, 15000);
});
