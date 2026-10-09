import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const obterUsuarioLogadoMock = vi.fn();
vi.mock("@/lib/sessao", () => ({
  obterUsuarioLogado: () => obterUsuarioLogadoMock(),
}));

import { buscarClientesParaPedido, criarPedidoRapido, desfazerPedidoRapido } from "../actions";

const CNPJ_FABRICA = "73100001000181";
const CNPJ_CLIENTE = "73100002000126";
const CNPJ_CLIENTE_BUSCA = "73100003000170";
const NOME_CLIENTE_SEM_CNPJ = "Cliente Sem CNPJ Rápido";
const DATA_PEDIDO = "2026-10-05";

async function cenario() {
  const fabrica = await prisma.fabrica.create({ data: { nome: "Fábrica Rápido Teste", cnpj: CNPJ_FABRICA } });
  const cliente = await prisma.cliente.create({ data: { cnpj: CNPJ_CLIENTE, nomeFantasia: "Cliente Rápido Teste" } });
  const usuario = await prisma.usuario.create({ data: { nome: "Adm Rápido", email: "pedido-rapido@teste.dev", perfil: "ADMIN" } });
  return { fabrica, cliente, usuario };
}

function dadosBase(c: { fabrica: { id: string }; cliente: { id: string } }) {
  return {
    fabricaId: c.fabrica.id,
    clienteId: c.cliente.id,
    novoCliente: null,
    valorTotal: "100,00",
    dataPedido: DATA_PEDIDO,
    numero: "",
    numeroCliente: "",
    observacao: "",
  };
}

// Apaga o que os testes criaram: pedidos da fábrica, clientes de teste (inclusive os
// cadastrados na hora pelo pedido rápido), auditoria e o usuário.
async function limpar(usuarioId: string, fabricaId: string) {
  const clientes = await prisma.cliente.findMany({
    where: { OR: [{ cnpj: { in: [CNPJ_CLIENTE, CNPJ_CLIENTE_BUSCA] } }, { nomeFantasia: { in: [NOME_CLIENTE_SEM_CNPJ, "Nome Digitado Errado", "Cliente Inválido"] } }] },
    select: { id: true },
  });
  const clienteIds = clientes.map((c) => c.id);
  await prisma.eventoAuditoria.deleteMany({ where: { usuarioId } });
  await prisma.itemPedido.deleteMany({ where: { pedido: { fabricaId } } });
  await prisma.pedido.deleteMany({ where: { fabricaId } });
  await prisma.interacao.deleteMany({ where: { clienteId: { in: clienteIds } } });
  await prisma.clienteFabrica.deleteMany({ where: { clienteId: { in: clienteIds } } });
  await prisma.cliente.deleteMany({ where: { id: { in: clienteIds } } });
  await prisma.usuario.deleteMany({ where: { id: usuarioId } });
  await prisma.fabrica.deleteMany({ where: { id: fabricaId } });
}

beforeEach(() => obterUsuarioLogadoMock.mockReset());

describe("criarPedidoRapido", () => {
  it("registra o pedido sem itens, em SEM_NFE, com valor, nº do cliente e data, liga o cliente à fábrica e audita", async () => {
    const c = await cenario();
    try {
      obterUsuarioLogadoMock.mockResolvedValue({ id: c.usuario.id, nome: "Adm", perfil: "ADMIN", fabricasIds: [] });

      const r = await criarPedidoRapido({ ...dadosBase(c), valorTotal: "18.611,00", numero: "R-101", numeroCliente: "OC-889" });

      expect(r.erros).toEqual([]);
      expect(r.pedidoId).toBeTruthy();
      expect(r.resumo).toContain("Fábrica Rápido Teste");
      expect(r.resumo).toContain("R$ 18.611,00");

      const pedido = await prisma.pedido.findUniqueOrThrow({ where: { id: r.pedidoId }, include: { itens: true } });
      expect(pedido).toMatchObject({ origem: "RAPIDO", estado: "SEM_NFE", numero: "R-101", numeroCliente: "OC-889", clienteId: c.cliente.id, fabricaId: c.fabrica.id });
      expect(pedido.itens).toHaveLength(0);
      expect(Number(pedido.valorTotalDeclarado)).toBe(18611);
      expect(pedido.dataPedido?.toISOString().slice(0, 10)).toBe(DATA_PEDIDO);

      expect(await prisma.clienteFabrica.count({ where: { clienteId: c.cliente.id, fabricaId: c.fabrica.id } })).toBe(1);

      const auditoria = await prisma.eventoAuditoria.findMany({ where: { entidade: "Pedido", entidadeId: pedido.id } });
      expect(auditoria.map((e) => e.campo)).toEqual(expect.arrayContaining(["origem", "valorTotalDeclarado"]));
      expect(auditoria.every((e) => e.usuarioId === c.usuario.id)).toBe(true);
    } finally {
      await limpar(c.usuario.id, c.fabrica.id);
    }
  }, 15000);

  it("cadastro novo sem CNPJ: cria o cliente na hora, com origem Pedido rápido, e liga o pedido a ele", async () => {
    const c = await cenario();
    try {
      obterUsuarioLogadoMock.mockResolvedValue({ id: c.usuario.id, nome: "Adm", perfil: "ADMIN", fabricasIds: [] });

      const r = await criarPedidoRapido({
        ...dadosBase(c),
        clienteId: "",
        novoCliente: { nome: NOME_CLIENTE_SEM_CNPJ, cnpj: "" },
        valorTotal: "500,00",
      });

      expect(r.erros).toEqual([]);
      const pedido = await prisma.pedido.findUniqueOrThrow({ where: { id: r.pedidoId }, include: { cliente: true } });
      expect(pedido.cliente).toMatchObject({ nomeFantasia: NOME_CLIENTE_SEM_CNPJ, cnpj: null, origem: "Pedido rápido" });
      expect(pedido.semNumero).toBe(true);
      expect(await prisma.eventoAuditoria.count({ where: { entidade: "Cliente", entidadeId: pedido.clienteId, usuarioId: c.usuario.id } })).toBeGreaterThan(0);
    } finally {
      await limpar(c.usuario.id, c.fabrica.id);
    }
  }, 15000);

  it("cadastro novo com CNPJ que já existe reusa a empresa cadastrada, sem duplicar", async () => {
    const c = await cenario();
    try {
      obterUsuarioLogadoMock.mockResolvedValue({ id: c.usuario.id, nome: "Adm", perfil: "ADMIN", fabricasIds: [] });

      const r = await criarPedidoRapido({
        ...dadosBase(c),
        clienteId: "",
        novoCliente: { nome: "Nome Digitado Errado", cnpj: "73.100.002/0001-26" },
        valorTotal: "300,00",
        numero: "R-150",
      });

      expect(r.erros).toEqual([]);
      const pedido = await prisma.pedido.findUniqueOrThrow({ where: { id: r.pedidoId } });
      expect(pedido.clienteId).toBe(c.cliente.id);
      expect(await prisma.cliente.count({ where: { cnpj: CNPJ_CLIENTE } })).toBe(1);
      expect(await prisma.cliente.count({ where: { nomeFantasia: "Nome Digitado Errado" } })).toBe(0);
    } finally {
      await limpar(c.usuario.id, c.fabrica.id);
    }
  }, 15000);

  it("validação: devolve os erros e não grava nada", async () => {
    const c = await cenario();
    try {
      obterUsuarioLogadoMock.mockResolvedValue({ id: c.usuario.id, nome: "Adm", perfil: "ADMIN", fabricasIds: [] });

      const vazio = await criarPedidoRapido({
        fabricaId: c.fabrica.id, clienteId: "", novoCliente: null, valorTotal: "", dataPedido: "", numero: "", numeroCliente: "", observacao: "",
      });
      expect(vazio.erros).toEqual(["Escolha o cliente.", "Informe o valor total do pedido.", "Informe a data do pedido."]);

      const invalido = await criarPedidoRapido({
        ...dadosBase(c),
        clienteId: "",
        novoCliente: { nome: "Cliente Inválido", cnpj: "73100002000127" },
        valorTotal: "0",
        dataPedido: "2999-01-01",
      });
      expect(invalido.erros).toEqual([
        "O CNPJ do cliente novo não é válido. Confira ou deixe em branco.",
        "O valor total tem de ser maior que zero.",
        "A data do pedido está no futuro.",
      ]);

      expect(await prisma.pedido.count({ where: { fabricaId: c.fabrica.id } })).toBe(0);
      expect(await prisma.cliente.count({ where: { nomeFantasia: "Cliente Inválido" } })).toBe(0);
    } finally {
      await limpar(c.usuario.id, c.fabrica.id);
    }
  }, 15000);

  it("OPERADOR sem a fábrica é recusado e não cria pedido nem cliente novo", async () => {
    const c = await cenario();
    try {
      obterUsuarioLogadoMock.mockResolvedValue({ id: c.usuario.id, nome: "Op", perfil: "OPERADOR", fabricasIds: ["outra"] });

      const existente = await criarPedidoRapido({ ...dadosBase(c), numero: "R-120" });
      expect(existente.erros).toEqual(["Você não tem permissão para registrar pedidos nesta fábrica."]);

      const novo = await criarPedidoRapido({
        ...dadosBase(c),
        clienteId: "",
        novoCliente: { nome: NOME_CLIENTE_SEM_CNPJ, cnpj: "" },
      });
      expect(novo.erros).toEqual(["Você não tem permissão para registrar pedidos nesta fábrica."]);

      expect(await prisma.pedido.count({ where: { fabricaId: c.fabrica.id } })).toBe(0);
      expect(await prisma.cliente.count({ where: { nomeFantasia: NOME_CLIENTE_SEM_CNPJ } })).toBe(0);
    } finally {
      await limpar(c.usuario.id, c.fabrica.id);
    }
  }, 15000);

  it("mesmo número para o mesmo cliente nesta fábrica devolve a mensagem amigável, sem segundo pedido", async () => {
    const c = await cenario();
    try {
      obterUsuarioLogadoMock.mockResolvedValue({ id: c.usuario.id, nome: "Adm", perfil: "ADMIN", fabricasIds: [] });

      const primeiro = await criarPedidoRapido({ ...dadosBase(c), numero: "R-200" });
      expect(primeiro.erros).toEqual([]);

      const segundo = await criarPedidoRapido({ ...dadosBase(c), numero: "R-200", valorTotal: "999,00" });

      expect(segundo.erros).toEqual(["Já existe um pedido com este número para este cliente nesta fábrica."]);
      expect(await prisma.pedido.count({ where: { fabricaId: c.fabrica.id, clienteId: c.cliente.id } })).toBe(1);
    } finally {
      await limpar(c.usuario.id, c.fabrica.id);
    }
  }, 15000);
});

describe("desfazerPedidoRapido", () => {
  it("desfaz o pedido recém-registrado e deixa o registro DESFEITO na auditoria", async () => {
    const c = await cenario();
    try {
      obterUsuarioLogadoMock.mockResolvedValue({ id: c.usuario.id, nome: "Adm", perfil: "ADMIN", fabricasIds: [] });
      const r = await criarPedidoRapido({ ...dadosBase(c), numero: "R-300" });

      const desfeito = await desfazerPedidoRapido(r.pedidoId!);

      expect(desfeito.erros).toEqual([]);
      expect(await prisma.pedido.findUnique({ where: { id: r.pedidoId } })).toBeNull();
      const auditoria = await prisma.eventoAuditoria.findMany({ where: { entidade: "Pedido", entidadeId: r.pedidoId, campo: "origem" } });
      expect(auditoria.map((e) => [e.valorAnterior, e.valorNovo])).toContainEqual(["RAPIDO", "DESFEITO"]);
    } finally {
      await limpar(c.usuario.id, c.fabrica.id);
    }
  }, 15000);

  it("recusa desfazer quando o pedido já ganhou item", async () => {
    const c = await cenario();
    try {
      obterUsuarioLogadoMock.mockResolvedValue({ id: c.usuario.id, nome: "Adm", perfil: "ADMIN", fabricasIds: [] });
      const r = await criarPedidoRapido({ ...dadosBase(c), numero: "R-310" });
      await prisma.itemPedido.create({
        data: { pedidoId: r.pedidoId!, referencia: "REF-X", descricao: "Peça", quantidadePedida: 1, valorUnitario: 10 },
      });

      const desfeito = await desfazerPedidoRapido(r.pedidoId!);

      expect(desfeito.erros).toEqual(["Este pedido já tem itens ou nota e não pode mais ser desfeito."]);
      expect(await prisma.pedido.findUnique({ where: { id: r.pedidoId } })).not.toBeNull();
    } finally {
      await limpar(c.usuario.id, c.fabrica.id);
    }
  }, 15000);

  it("recusa desfazer depois de 10 minutos e mantém o pedido", async () => {
    const c = await cenario();
    try {
      obterUsuarioLogadoMock.mockResolvedValue({ id: c.usuario.id, nome: "Adm", perfil: "ADMIN", fabricasIds: [] });
      const r = await criarPedidoRapido({ ...dadosBase(c), numero: "R-320" });
      await prisma.pedido.update({ where: { id: r.pedidoId }, data: { criadoEm: new Date(Date.now() - 11 * 60 * 1000) } });

      const desfeito = await desfazerPedidoRapido(r.pedidoId!);

      expect(desfeito.erros).toEqual(["Passou o tempo de desfazer. Abra o pedido para arquivar."]);
      expect(await prisma.pedido.findUnique({ where: { id: r.pedidoId } })).not.toBeNull();
    } finally {
      await limpar(c.usuario.id, c.fabrica.id);
    }
  }, 15000);
});

describe("buscarClientesParaPedido", () => {
  it("acha por nome sem diferenciar maiúsculas e por dígitos do CNPJ; termo curto devolve lista vazia", async () => {
    const cliente = await prisma.cliente.create({
      data: { nomeFantasia: "Distribuidora Vetor Teste", cnpj: CNPJ_CLIENTE_BUSCA, cidade: "Curitiba", uf: "PR" },
    });
    try {
      obterUsuarioLogadoMock.mockResolvedValue({ id: "sessao-busca", nome: "Op", perfil: "ADMIN", fabricasIds: [] });

      const porNome = await buscarClientesParaPedido("distribuidora vetor");
      expect(porNome.map((c) => c.id)).toContain(cliente.id);

      const porCnpj = await buscarClientesParaPedido("73.100.003/0001-70");
      expect(porCnpj.find((c) => c.id === cliente.id)).toMatchObject({
        nome: "Distribuidora Vetor Teste",
        cnpj: CNPJ_CLIENTE_BUSCA,
        cidade: "Curitiba",
        uf: "PR",
      });

      expect(await buscarClientesParaPedido("d")).toEqual([]);
      expect(await buscarClientesParaPedido("   ")).toEqual([]);
    } finally {
      await prisma.cliente.delete({ where: { id: cliente.id } });
    }
  }, 15000);
});
