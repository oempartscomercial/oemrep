import { describe, it, expect, vi, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { montarXmlNFe } from "@/test-support/nfe-xml";

const obterUsuarioLogadoMock = vi.fn();
vi.mock("@/lib/sessao", () => ({
  obterUsuarioLogado: () => obterUsuarioLogadoMock(),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

import { analisarXmlNFe, confirmarBaixaNFe } from "../actions";

const ADMIN = { id: "", nome: "Adm", perfil: "ADMIN" as const, fabricasIds: [] as string[] };

// Cada teste cria seu cenário com CNPJs próprios e apaga tudo no fim.
async function cenario(sufixo: string, opcoes: { clienteSemCnpj?: boolean } = {}) {
  const fabrica = await prisma.fabrica.create({ data: { nome: `Fábrica Conf ${sufixo}`, cnpj: `810000000${sufixo}001` } });
  const cnpjCliente = `810000000${sufixo}002`;
  const cliente = await prisma.cliente.create({
    data: { cnpj: opcoes.clienteSemCnpj ? null : cnpjCliente, nomeFantasia: `Cliente Conf ${sufixo}` },
  });
  const usuario = await prisma.usuario.create({
    data: { nome: "Adm Conf", email: `adm-conf-${sufixo}@teste.local`, perfil: "ADMIN" },
  });
  const pedido = await prisma.pedido.create({
    data: {
      numero: `PED-CONF-${sufixo}`, origem: "MANUAL", fabricaId: fabrica.id, clienteId: cliente.id,
      itens: { create: [{ referencia: "REF-1", descricao: "Peça", quantidadePedida: 10, valorUnitario: 25 }] },
    },
    include: { itens: true },
  });
  const chaveAcesso = `3526078100000000${sufixo}550010000094011123456789`.slice(0, 44);
  const xml = (quantidade = 4) =>
    montarXmlNFe({
      chaveAcesso, numero: `94${sufixo}`, emitenteCnpj: fabrica.cnpj, destinatarioCnpj: cnpjCliente,
      itens: [{ referencia: "REF-1", quantidade, valorUnitario: 25 }],
    });
  const limpar = async () => {
    await prisma.itemFaturado.deleteMany({ where: { itemPedidoId: pedido.itens[0].id } });
    await prisma.notaFiscalPedido.deleteMany({ where: { pedidoId: pedido.id } });
    await prisma.notaFiscal.deleteMany({ where: { chaveAcesso } });
    await prisma.eventoAuditoria.deleteMany({ where: { usuarioId: usuario.id } });
    await prisma.itemPedido.deleteMany({ where: { pedidoId: pedido.id } });
    await prisma.pedido.delete({ where: { id: pedido.id } });
    await prisma.cliente.delete({ where: { id: cliente.id } });
    await prisma.usuario.delete({ where: { id: usuario.id } });
    await prisma.fabrica.delete({ where: { id: fabrica.id } });
  };
  return { fabrica, cliente, cnpjCliente, usuario, pedido, chaveAcesso, xml, limpar };
}

function arquivo(xml: string) {
  const formData = new FormData();
  formData.append("arquivo", new File([xml], "nota.xml", { type: "text/xml" }));
  return formData;
}

afterEach(() => obterUsuarioLogadoMock.mockReset());

describe("analisarXmlNFe — sessão e permissão por fábrica (ADR-009)", () => {
  it("recusa sem sessão e em fábrica não permitida", async () => {
    const c = await cenario("11");
    try {
      obterUsuarioLogadoMock.mockResolvedValue(null);
      expect((await analisarXmlNFe(arquivo(c.xml()))).erro).toBe("Sessão expirada. Faça login novamente.");

      obterUsuarioLogadoMock.mockResolvedValue({ id: c.usuario.id, nome: "Op", perfil: "OPERADOR", fabricasIds: ["outra"] });
      expect((await analisarXmlNFe(arquivo(c.xml()))).erro).toBe("Você não tem permissão para conferir notas desta fábrica.");
      expect((await confirmarBaixaNFe({ xml: c.xml(), clienteId: null })).erros).toEqual([
        "Você não tem permissão para conferir notas desta fábrica.",
      ]);
    } finally {
      await c.limpar();
    }
  }, 15000);
});

describe("confirmarBaixaNFe — recalcula tudo no servidor", () => {
  it("dá baixa com as quantidades do XML, não com dados vindos da tela", async () => {
    const c = await cenario("12");
    try {
      obterUsuarioLogadoMock.mockResolvedValue({ ...ADMIN, id: c.usuario.id });

      const resultado = await confirmarBaixaNFe({ xml: c.xml(4), clienteId: null });

      expect(resultado.erros).toEqual([]);
      const item = await prisma.itemPedido.findUniqueOrThrow({ where: { id: c.pedido.itens[0].id } });
      expect(item.quantidadeFaturada).toBe(4);
      const pedido = await prisma.pedido.findUniqueOrThrow({ where: { id: c.pedido.id } });
      expect(pedido.estado).toBe("PARCIAL");
    } finally {
      await c.limpar();
    }
  }, 15000);

  it("recusa nota já importada sem gravar nada", async () => {
    const c = await cenario("13");
    try {
      obterUsuarioLogadoMock.mockResolvedValue({ ...ADMIN, id: c.usuario.id });
      expect((await confirmarBaixaNFe({ xml: c.xml(), clienteId: null })).erros).toEqual([]);

      const segunda = await confirmarBaixaNFe({ xml: c.xml(), clienteId: null });

      expect(segunda.erros).toEqual(["Esta NFe já foi importada."]);
      const item = await prisma.itemPedido.findUniqueOrThrow({ where: { id: c.pedido.itens[0].id } });
      expect(item.quantidadeFaturada).toBe(4);
    } finally {
      await c.limpar();
    }
  }, 15000);

  it("não deixa nada gravado quando a gravação falha no meio (auditoria)", async () => {
    const c = await cenario("14");
    try {
      // Usuário fora da tabela Usuario: só a auditoria falha por FK, e a transação
      // precisa desfazer nota, baixa e estado do pedido.
      obterUsuarioLogadoMock.mockResolvedValue({ ...ADMIN, id: "usuario-que-nao-existe" });

      const resultado = await confirmarBaixaNFe({ xml: c.xml(), clienteId: null });

      expect(resultado.erros).toEqual(["Falha ao gravar a baixa da NFe. Nada foi salvo — tente novamente."]);
      expect(await prisma.notaFiscal.findMany({ where: { chaveAcesso: c.chaveAcesso } })).toHaveLength(0);
      const item = await prisma.itemPedido.findUniqueOrThrow({ where: { id: c.pedido.itens[0].id } });
      expect(item.quantidadeFaturada).toBe(0);
      expect((await prisma.pedido.findUniqueOrThrow({ where: { id: c.pedido.id } })).estado).toBe("SEM_NFE");
    } finally {
      await c.limpar();
    }
  }, 15000);
});

describe("conferência de cliente sem CNPJ (ADR-013)", () => {
  it("oferece as empresas sem CNPJ com pedido aberto e grava o CNPJ da nota na escolhida", async () => {
    const c = await cenario("15", { clienteSemCnpj: true });
    try {
      obterUsuarioLogadoMock.mockResolvedValue({ ...ADMIN, id: c.usuario.id });

      const semEscolha = await analisarXmlNFe(arquivo(c.xml()));
      expect(semEscolha.analise?.clienteId).toBeNull();
      expect(semEscolha.analise?.candidatos.map((e) => e.id)).toContain(c.cliente.id);

      const formData = arquivo(c.xml());
      formData.append("clienteId", c.cliente.id);
      const comEscolha = await analisarXmlNFe(formData);
      expect(comEscolha.analise?.clienteId).toBe(c.cliente.id);
      expect(comEscolha.analise?.gravarCnpj).toBe(true);
      expect(comEscolha.analise?.conferencia[0].pendencia?.pedidoId).toBe(c.pedido.id);

      const resultado = await confirmarBaixaNFe({ xml: c.xml(), clienteId: c.cliente.id });

      expect(resultado.erros).toEqual([]);
      const cliente = await prisma.cliente.findUniqueOrThrow({ where: { id: c.cliente.id } });
      expect(cliente.cnpj).toBe(c.cnpjCliente);
      const auditoria = await prisma.eventoAuditoria.findMany({ where: { entidade: "Cliente", entidadeId: c.cliente.id } });
      expect(auditoria.map((e) => [e.campo, e.valorAnterior, e.valorNovo])).toEqual([["cnpj", null, c.cnpjCliente]]);
    } finally {
      await c.limpar();
    }
  }, 15000);
});
