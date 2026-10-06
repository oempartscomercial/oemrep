import { describe, it, expect, vi, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";

const obterUsuarioLogadoMock = vi.fn();
vi.mock("@/lib/sessao", () => ({
  obterUsuarioLogado: () => obterUsuarioLogadoMock(),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

import { criarFabrica } from "../fabricas/actions";
import { criarCliente } from "../clientes/actions";

afterEach(() => obterUsuarioLogadoMock.mockReset());

function form(campos: Record<string, string | string[]>) {
  const formData = new FormData();
  for (const [chave, valor] of Object.entries(campos)) {
    for (const v of Array.isArray(valor) ? valor : [valor]) formData.append(chave, v);
  }
  return formData;
}

describe("cadastros de fábrica e cliente — só ADMIN (PRD §4, ADR-009)", () => {
  it("recusa operador e analista sem gravar nada", async () => {
    for (const perfil of ["OPERADOR", "ANALISTA"]) {
      obterUsuarioLogadoMock.mockResolvedValue({ id: "u", nome: "X", perfil, fabricasIds: [] });

      expect(await criarFabrica(form({ nome: "Fábrica Proibida", cnpj: "11.444.777/0001-61" }))).toEqual({
        erros: ["Apenas ADMIN pode cadastrar fábricas."],
      });
      expect(
        await criarCliente(form({ nomeFantasia: "Cliente Proibido", cnpj: "11.222.333/0001-81", fabricasIds: ["f"] })),
      ).toEqual({ erros: ["Apenas ADMIN pode cadastrar clientes."] });
    }
    expect(await prisma.fabrica.findMany({ where: { nome: "Fábrica Proibida" } })).toHaveLength(0);
    expect(await prisma.cliente.findMany({ where: { nomeFantasia: "Cliente Proibido" } })).toHaveLength(0);
  });

  it("devolve mensagem clara para CNPJ já cadastrado em vez de estourar", async () => {
    const usuario = await prisma.usuario.create({ data: { nome: "Adm Cad", email: "adm-cad@teste.local", perfil: "ADMIN" } });
    const fabrica = await prisma.fabrica.create({ data: { nome: "Fábrica Existente", cnpj: "11444777000161" } });
    const cliente = await prisma.cliente.create({ data: { nomeFantasia: "Cliente Existente", cnpj: "11222333000181" } });
    try {
      obterUsuarioLogadoMock.mockResolvedValue({ id: usuario.id, nome: "Adm", perfil: "ADMIN", fabricasIds: [] });

      expect(await criarFabrica(form({ nome: "Outra", cnpj: "11.444.777/0001-61" }))).toEqual({
        erros: ["Já existe uma fábrica com este CNPJ."],
      });
      expect(
        await criarCliente(form({ nomeFantasia: "Outro", cnpj: "11.222.333/0001-81", fabricasIds: [fabrica.id] })),
      ).toEqual({ erros: ["Já existe uma empresa com este CNPJ."] });
    } finally {
      await prisma.cliente.delete({ where: { id: cliente.id } });
      await prisma.fabrica.delete({ where: { id: fabrica.id } });
      await prisma.usuario.delete({ where: { id: usuario.id } });
    }
  });
});
