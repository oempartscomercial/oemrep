import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const obterUsuarioLogadoMock = vi.fn();
vi.mock("@/lib/sessao", () => ({
  obterUsuarioLogado: () => obterUsuarioLogadoMock(),
}));

import { confirmarImportacaoPdf } from "../actions";

const CNPJ_FABRICA = "92000001000154";
const CNPJ_CLIENTE = "92000002000107";

async function cenario() {
  const fabrica = await prisma.fabrica.create({ data: { nome: "Fábrica PDF Action", cnpj: CNPJ_FABRICA } });
  const cliente = await prisma.cliente.create({ data: { cnpj: CNPJ_CLIENTE, nomeFantasia: "Cliente PDF Action" } });
  const usuario = await prisma.usuario.create({ data: { nome: "Op PDF", email: "pdf-action@teste.dev" } });
  const arquivo = await prisma.arquivoImportado.create({
    data: {
      nomeOriginal: "pedido.pdf",
      caminhoStorage: `teste/pdf-action-${CNPJ_FABRICA}.pdf`,
      tamanhoBytes: 1234,
      mimeType: "application/pdf",
      enviadoPorId: usuario.id,
    },
  });
  const importacao = await prisma.importacaoPedido.create({
    data: { arquivoId: arquivo.id, estado: "AGUARDANDO_REVISAO", criadoPorId: usuario.id, fabricaId: fabrica.id, clienteId: cliente.id },
  });
  return { fabrica, cliente, usuario, arquivo, importacao };
}

async function limpar(ids: { importacaoId: string; arquivoId: string; usuarioId: string; fabricaId: string; clienteId: string }) {
  const pedidos = await prisma.pedido.findMany({ where: { fabricaId: ids.fabricaId }, select: { id: true } });
  const pedidoIds = pedidos.map((p) => p.id);
  await prisma.eventoAuditoria.deleteMany({ where: { usuarioId: ids.usuarioId } });
  await prisma.importacaoPedido.deleteMany({ where: { id: ids.importacaoId } });
  await prisma.itemPedido.deleteMany({ where: { pedidoId: { in: pedidoIds } } });
  await prisma.pedido.deleteMany({ where: { id: { in: pedidoIds } } });
  await prisma.arquivoImportado.deleteMany({ where: { id: ids.arquivoId } });
  await prisma.usuario.deleteMany({ where: { id: ids.usuarioId } });
  await prisma.cliente.deleteMany({ where: { id: ids.clienteId } });
  await prisma.fabrica.deleteMany({ where: { id: ids.fabricaId } });
}

const item = { referencia: "40150270", descricao: "Cabo", quantidade: 40, valorUnitario: 205.569 };

beforeEach(() => obterUsuarioLogadoMock.mockReset());

describe("confirmarImportacaoPdf", () => {
  it("recusa confirmar em fábrica sem permissão e não cria pedido", async () => {
    const c = await cenario();
    try {
      obterUsuarioLogadoMock.mockResolvedValue({ id: c.usuario.id, nome: "Op", perfil: "OPERADOR", fabricasIds: ["outra"] });

      const r = await confirmarImportacaoPdf({
        importacaoId: c.importacao.id, fabricaId: c.fabrica.id, clienteId: c.cliente.id,
        numero: "4103", semNumero: false, itens: [item],
      });

      expect(r.erros[0]).toContain("permissão");
      expect(await prisma.pedido.count({ where: { fabricaId: c.fabrica.id } })).toBe(0);
    } finally {
      await limpar({ importacaoId: c.importacao.id, arquivoId: c.arquivo.id, usuarioId: c.usuario.id, fabricaId: c.fabrica.id, clienteId: c.cliente.id });
    }
  }, 15000);

  it("cria o pedido com origem PDF, guarda o valor com 4 casas e liga ao arquivo-fonte", async () => {
    const c = await cenario();
    try {
      obterUsuarioLogadoMock.mockResolvedValue({ id: c.usuario.id, nome: "Op", perfil: "ADMIN", fabricasIds: [] });

      const r = await confirmarImportacaoPdf({
        importacaoId: c.importacao.id, fabricaId: c.fabrica.id, clienteId: c.cliente.id,
        numero: "4103", semNumero: false, itens: [item],
      });

      expect(r.erros).toEqual([]);
      const pedido = await prisma.pedido.findFirst({ where: { fabricaId: c.fabrica.id }, include: { itens: true } });
      expect(pedido?.origem).toBe("PDF");
      expect(pedido?.numero).toBe("4103");
      expect(pedido?.arquivoOrigemId).toBe(c.arquivo.id);
      expect(Number(pedido?.itens[0].valorUnitario)).toBe(205.569);
    } finally {
      await limpar({ importacaoId: c.importacao.id, arquivoId: c.arquivo.id, usuarioId: c.usuario.id, fabricaId: c.fabrica.id, clienteId: c.cliente.id });
    }
  }, 15000);

  it("marca o rascunho como CONFIRMADA e o vincula ao pedido criado", async () => {
    const c = await cenario();
    try {
      obterUsuarioLogadoMock.mockResolvedValue({ id: c.usuario.id, nome: "Op", perfil: "ADMIN", fabricasIds: [] });

      await confirmarImportacaoPdf({
        importacaoId: c.importacao.id, fabricaId: c.fabrica.id, clienteId: c.cliente.id,
        numero: "4103", semNumero: false, itens: [item],
      });

      const rascunho = await prisma.importacaoPedido.findUnique({ where: { id: c.importacao.id } });
      const pedido = await prisma.pedido.findFirst({ where: { fabricaId: c.fabrica.id } });
      expect(rascunho?.estado).toBe("CONFIRMADA");
      expect(rascunho?.pedidoId).toBe(pedido?.id);
    } finally {
      await limpar({ importacaoId: c.importacao.id, arquivoId: c.arquivo.id, usuarioId: c.usuario.id, fabricaId: c.fabrica.id, clienteId: c.cliente.id });
    }
  }, 15000);

  it("audita a criação do pedido e de cada item", async () => {
    const c = await cenario();
    try {
      obterUsuarioLogadoMock.mockResolvedValue({ id: c.usuario.id, nome: "Op", perfil: "ADMIN", fabricasIds: [] });

      await confirmarImportacaoPdf({
        importacaoId: c.importacao.id, fabricaId: c.fabrica.id, clienteId: c.cliente.id,
        numero: "4103", semNumero: false, itens: [item],
      });

      const eventos = await prisma.eventoAuditoria.findMany({ where: { usuarioId: c.usuario.id } });
      expect(eventos.some((e) => e.entidade === "Pedido")).toBe(true);
      expect(eventos.some((e) => e.entidade === "ItemPedido")).toBe(true);
    } finally {
      await limpar({ importacaoId: c.importacao.id, arquivoId: c.arquivo.id, usuarioId: c.usuario.id, fabricaId: c.fabrica.id, clienteId: c.cliente.id });
    }
  }, 15000);
});
