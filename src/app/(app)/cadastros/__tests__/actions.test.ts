import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";

const obterUsuarioLogadoMock = vi.fn();
vi.mock("@/lib/sessao", () => ({
  obterUsuarioLogado: () => obterUsuarioLogadoMock(),
}));

import { criarFabrica } from "../fabricas/actions";
import { criarCliente } from "../clientes/actions";

const CNPJ_FABRICA = "91000001000191";
const CNPJ_FABRICA_DUPLICADA = "91000002000136";
const CNPJ_CLIENTE = "91000003000180";
const CNPJ_CLIENTE_DUPLICADO = "91000004000125";

const OPERADOR = { id: "u-op", nome: "Op", perfil: "OPERADOR" as const, fabricasIds: [] };
const ADMIN = { id: "u-adm", nome: "Chefe", perfil: "ADMIN" as const, fabricasIds: [] };

const formFabrica = (cnpj: string) => {
  const fd = new FormData();
  fd.set("nome", "Fábrica de Teste");
  fd.set("cnpj", cnpj);
  return fd;
};

const formCliente = (cnpj: string) => {
  const fd = new FormData();
  fd.set("nomeFantasia", "Cliente de Teste");
  fd.set("cnpj", cnpj);
  fd.append("fabricasIds", "qualquer");
  return fd;
};

beforeEach(() => {
  obterUsuarioLogadoMock.mockReset();
});

describe("criarFabrica — acesso restrito a ADMIN", () => {
  it("recusa operador que não é ADMIN", async () => {
    obterUsuarioLogadoMock.mockResolvedValue(OPERADOR);

    const resultado = await criarFabrica(formFabrica(CNPJ_FABRICA));

    expect(resultado.erros).toEqual(["Apenas ADMIN pode cadastrar fábricas."]);
    const criada = await prisma.fabrica.findUnique({ where: { cnpj: CNPJ_FABRICA } });
    expect(criada).toBeNull();
  }, 15000);

  it("avisa em vez de estourar quando o CNPJ já existe", async () => {
    const existente = await prisma.fabrica.create({
      data: { nome: "Fábrica Já Existente", cnpj: CNPJ_FABRICA_DUPLICADA },
    });

    try {
      obterUsuarioLogadoMock.mockResolvedValue(ADMIN);

      const resultado = await criarFabrica(formFabrica(CNPJ_FABRICA_DUPLICADA));

      expect(resultado.erros).toEqual(["Já existe uma fábrica com este CNPJ."]);
    } finally {
      await prisma.fabrica.delete({ where: { id: existente.id } });
    }
  }, 15000);
});

describe("criarCliente — acesso restrito a ADMIN", () => {
  it("recusa operador que não é ADMIN", async () => {
    obterUsuarioLogadoMock.mockResolvedValue(OPERADOR);

    const resultado = await criarCliente(formCliente(CNPJ_CLIENTE));

    expect(resultado.erros).toEqual(["Apenas ADMIN pode cadastrar clientes."]);
    const criado = await prisma.cliente.findUnique({ where: { cnpj: CNPJ_CLIENTE } });
    expect(criado).toBeNull();
  }, 15000);

  it("avisa em vez de estourar quando o CNPJ já existe", async () => {
    const existente = await prisma.cliente.create({
      data: { nomeFantasia: "Cliente Já Existente", cnpj: CNPJ_CLIENTE_DUPLICADO },
    });

    try {
      obterUsuarioLogadoMock.mockResolvedValue(ADMIN);

      const resultado = await criarCliente(formCliente(CNPJ_CLIENTE_DUPLICADO));

      expect(resultado.erros).toEqual(["Já existe um cliente com este CNPJ."]);
    } finally {
      await prisma.cliente.delete({ where: { id: existente.id } });
    }
  }, 15000);

  // Antes, o Cliente era criado e só então os vínculos; uma fábrica inexistente
  // estourava a FK e deixava um cliente órfão, sem nenhum vínculo de fábrica.
  it("não deixa cliente órfão quando uma das fábricas não existe", async () => {
    obterUsuarioLogadoMock.mockResolvedValue(ADMIN);

    const resultado = await criarCliente(formCliente(CNPJ_CLIENTE));

    expect(resultado.erros.length).toBeGreaterThan(0);
    const orfao = await prisma.cliente.findUnique({ where: { cnpj: CNPJ_CLIENTE } });
    expect(orfao).toBeNull();
  }, 15000);
});
