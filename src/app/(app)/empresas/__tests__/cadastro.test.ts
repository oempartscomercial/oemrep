import { describe, it, expect, vi, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";

const obterUsuarioLogadoMock = vi.fn();
vi.mock("@/lib/sessao", () => ({ obterUsuarioLogado: () => obterUsuarioLogadoMock() }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

import { editarCadastroEmpresa } from "../actions";

afterEach(() => obterUsuarioLogadoMock.mockReset());

const vazio = { nome: "", cnpj: "", uf: "", cidade: "", site: "", grupo: "", origem: "", observacoes: "", fabricasIds: [] as string[] };

async function cenario(sufixo: string, situacao: "CANDIDATA" | "CLIENTE") {
  const admin = await prisma.usuario.create({ data: { nome: "Adm Ficha", email: `adm-ficha-${sufixo}@teste.local`, perfil: "ADMIN" } });
  const fabA = await prisma.fabrica.create({ data: { nome: `Fab A Ficha ${sufixo}`, cnpj: `8400000000${sufixo === "a" ? "0101" : "0202"}` } });
  const empresa = await prisma.cliente.create({
    data: { nomeFantasia: `Empresa Ficha ${sufixo}`, situacao, cidade: "Recife", uf: "PE", fabricas: situacao === "CLIENTE" ? { create: [{ fabricaId: fabA.id }] } : undefined },
  });
  const limpar = async () => {
    await prisma.eventoAuditoria.deleteMany({ where: { usuarioId: admin.id } });
    await prisma.clienteFabrica.deleteMany({ where: { clienteId: empresa.id } });
    await prisma.cliente.delete({ where: { id: empresa.id } });
    await prisma.fabrica.delete({ where: { id: fabA.id } });
    await prisma.usuario.delete({ where: { id: admin.id } });
  };
  const logar = (perfil: "ADMIN" | "ANALISTA" = "ADMIN") => obterUsuarioLogadoMock.mockResolvedValue({ id: admin.id, nome: admin.nome, perfil, fabricasIds: [] });
  return { admin, fabA, empresa, limpar, logar };
}

describe("editar cadastro na ficha da empresa", () => {
  it("grava as propriedades de uma empresa em prospecção sem exigir fábrica, com auditoria", async () => {
    const c = await cenario("a", "CANDIDATA");
    try {
      c.logar();
      const r = await editarCadastroEmpresa(c.empresa.id, { ...vazio, nome: "Empresa Ficha Nova", uf: "ce", cidade: "Fortaleza", site: "ficha.com.br", observacoes: "Revende Rudolph" });
      expect(r).toEqual({ erros: [] });
      const salva = await prisma.cliente.findUniqueOrThrow({ where: { id: c.empresa.id } });
      expect(salva).toMatchObject({ nomeFantasia: "Empresa Ficha Nova", uf: "CE", cidade: "Fortaleza", site: "ficha.com.br", observacoes: "Revende Rudolph", situacao: "CANDIDATA" });
      const campos = (await prisma.eventoAuditoria.findMany({ where: { entidadeId: c.empresa.id } })).map((e) => e.campo).sort();
      expect(campos).toEqual(["cidade", "nomeFantasia", "observacoes", "site", "uf"]);
    } finally {
      await c.limpar();
    }
  });

  it("cliente precisa de fábrica; troca de fábricas sincroniza os vínculos", async () => {
    const c = await cenario("b", "CLIENTE");
    try {
      c.logar();
      expect(await editarCadastroEmpresa(c.empresa.id, { ...vazio, nome: "X" })).toEqual({ erros: ["Cliente precisa de ao menos uma fábrica."] });
      expect(await editarCadastroEmpresa(c.empresa.id, { ...vazio, nome: "Empresa Ficha b", uf: "PE", cidade: "Recife", fabricasIds: [c.fabA.id] })).toEqual({ erros: [] });
      expect(await prisma.clienteFabrica.count({ where: { clienteId: c.empresa.id } })).toBe(1);
    } finally {
      await c.limpar();
    }
  });

  it("recusa CNPJ de outra empresa e quem não é ADMIN", async () => {
    const c = await cenario("c", "CANDIDATA");
    const outra = await prisma.cliente.create({ data: { nomeFantasia: "Outra Ficha", cnpj: "11444777000161", situacao: "CANDIDATA" } });
    try {
      c.logar();
      expect(await editarCadastroEmpresa(c.empresa.id, { ...vazio, nome: "Y", cnpj: "11.444.777/0001-61" })).toEqual({ erros: ["Já existe uma empresa com este CNPJ: Outra Ficha."] });
      c.logar("ANALISTA");
      expect(await editarCadastroEmpresa(c.empresa.id, { ...vazio, nome: "Y" })).toEqual({ erros: ["Só administrador altera o cadastro da empresa."] });
      obterUsuarioLogadoMock.mockResolvedValue(null);
      expect(await editarCadastroEmpresa(c.empresa.id, { ...vazio, nome: "Y" })).toEqual({ erros: ["Sessão expirada. Faça login novamente."] });
    } finally {
      await prisma.cliente.delete({ where: { id: outra.id } });
      await c.limpar();
    }
  });
});
