import { describe, it, expect, vi, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";

const obterUsuarioLogadoMock = vi.fn();
vi.mock("@/lib/sessao", () => ({
  obterUsuarioLogado: () => obterUsuarioLogadoMock(),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

import { editarFabrica, alterarAtivoFabrica } from "../fabricas/actions";
import { editarCliente } from "../clientes/actions";
import { editarUsuario, alterarAtivoUsuario } from "../usuarios/actions";
import { GET as getFabricas } from "@/app/api/fabricas/route";

afterEach(() => obterUsuarioLogadoMock.mockReset());

function form(campos: Record<string, string | string[]>) {
  const formData = new FormData();
  for (const [chave, valor] of Object.entries(campos)) {
    for (const v of Array.isArray(valor) ? valor : [valor]) formData.append(chave, v);
  }
  return formData;
}

async function comAdmin<T>(sufixo: string, corpo: (adminId: string) => Promise<T>) {
  const admin = await prisma.usuario.create({ data: { nome: "Adm Ed", email: `adm-ed-${sufixo}@teste.local`, perfil: "ADMIN" } });
  obterUsuarioLogadoMock.mockResolvedValue({ id: admin.id, nome: "Adm Ed", perfil: "ADMIN", fabricasIds: [] });
  try {
    return await corpo(admin.id);
  } finally {
    await prisma.eventoAuditoria.deleteMany({ where: { usuarioId: admin.id } });
    await prisma.usuario.delete({ where: { id: admin.id } });
  }
}

const auditoria = (entidadeId: string) =>
  prisma.eventoAuditoria
    .findMany({ where: { entidadeId }, orderBy: { campo: "asc" } })
    .then((eventos) => eventos.map((e) => [e.campo, e.valorAnterior, e.valorNovo]));

describe("editar e desativar fábrica", () => {
  it("edita nome e CNPJ com auditoria, recusa CNPJ de outra e some dos formulários quando inativa", async () => {
    const fabrica = await prisma.fabrica.create({ data: { nome: "Fábrica Ed", cnpj: "83456789000117" } });
    const outra = await prisma.fabrica.create({ data: { nome: "Outra Ed", cnpj: "11444777000161" } });
    try {
      await comAdmin("f", async () => {
        expect(await editarFabrica(fabrica.id, form({ nome: "Fábrica Editada", cnpj: "11.444.777/0001-61" }))).toEqual({
          erros: ["Já existe uma fábrica com este CNPJ."],
        });

        expect(await editarFabrica(fabrica.id, form({ nome: "Fábrica Editada", cnpj: "83456789000117" }))).toEqual({ erros: [] });
        expect(await auditoria(fabrica.id)).toEqual([["nome", "Fábrica Ed", "Fábrica Editada"]]);

        expect(await alterarAtivoFabrica(fabrica.id, false)).toEqual({ erros: [] });
        const ids = ((await (await getFabricas()).json()) as { id: string }[]).map((f) => f.id);
        expect(ids).not.toContain(fabrica.id);
        expect(ids).toContain(outra.id);
      });
    } finally {
      await prisma.fabrica.deleteMany({ where: { id: { in: [fabrica.id, outra.id] } } });
    }
  });

  it("recusa quem não é ADMIN", async () => {
    obterUsuarioLogadoMock.mockResolvedValue({ id: "u", nome: "Op", perfil: "OPERADOR", fabricasIds: [] });
    expect(await editarFabrica("x", form({ nome: "N", cnpj: "11444777000161" }))).toEqual({
      erros: ["Apenas ADMIN pode alterar fábricas."],
    });
    expect(await alterarAtivoFabrica("x", false)).toEqual({ erros: ["Apenas ADMIN pode alterar fábricas."] });
  });
});

describe("editar cliente", () => {
  it("troca nome, aceita CNPJ vazio, sincroniza fábricas e audita", async () => {
    const fabA = await prisma.fabrica.create({ data: { nome: "Fab A Ed", cnpj: "83000000000202" } });
    const fabB = await prisma.fabrica.create({ data: { nome: "Fab B Ed", cnpj: "83000000000303" } });
    const cliente = await prisma.cliente.create({
      data: { nomeFantasia: "Cliente Ed", fabricas: { create: [{ fabricaId: fabA.id }] } },
    });
    try {
      await comAdmin("c", async () => {
        const resultado = await editarCliente(
          cliente.id,
          form({ nomeFantasia: "Cliente Editado", cnpj: "", fabricasIds: [fabB.id] }),
        );
        expect(resultado).toEqual({ erros: [] });

        const lido = await prisma.cliente.findUniqueOrThrow({ where: { id: cliente.id }, include: { fabricas: true } });
        expect(lido.nomeFantasia).toBe("Cliente Editado");
        expect(lido.cnpj).toBeNull();
        expect(lido.fabricas.map((f) => f.fabricaId)).toEqual([fabB.id]);
        expect(await auditoria(cliente.id)).toEqual([
          ["fabricasIds", fabA.id, fabB.id],
          ["nomeFantasia", "Cliente Ed", "Cliente Editado"],
        ]);
      });
    } finally {
      await prisma.clienteFabrica.deleteMany({ where: { clienteId: cliente.id } });
      await prisma.cliente.delete({ where: { id: cliente.id } });
      await prisma.fabrica.deleteMany({ where: { id: { in: [fabA.id, fabB.id] } } });
    }
  });
});

describe("editar e desativar usuário", () => {
  it("troca perfil e fábricas, não deixa o ADMIN se desativar e desativa outro", async () => {
    const fab = await prisma.fabrica.create({ data: { nome: "Fab U Ed", cnpj: "83000000000404" } });
    const pessoa = await prisma.usuario.create({ data: { nome: "Pessoa Ed", email: "pessoa-ed@teste.local", perfil: "ADMIN" } });
    try {
      await comAdmin("u", async (adminId) => {
        expect(
          await editarUsuario(pessoa.id, form({ nome: "Pessoa Editada", perfil: "OPERADOR", fabricasIds: [fab.id] })),
        ).toEqual({ erros: [] });
        const lida = await prisma.usuario.findUniqueOrThrow({ where: { id: pessoa.id }, include: { fabricas: true } });
        expect([lida.nome, lida.perfil, lida.fabricas.map((f) => f.fabricaId)]).toEqual(["Pessoa Editada", "OPERADOR", [fab.id]]);

        expect(await alterarAtivoUsuario(adminId, false)).toEqual({ erros: ["Você não pode desativar o próprio acesso."] });
        expect(await alterarAtivoUsuario(pessoa.id, false)).toEqual({ erros: [] });
        expect((await prisma.usuario.findUniqueOrThrow({ where: { id: pessoa.id } })).ativo).toBe(false);
      });
    } finally {
      await prisma.eventoAuditoria.deleteMany({ where: { entidadeId: pessoa.id } });
      await prisma.usuarioFabrica.deleteMany({ where: { usuarioId: pessoa.id } });
      await prisma.usuario.delete({ where: { id: pessoa.id } });
      await prisma.fabrica.delete({ where: { id: fab.id } });
    }
  });
});
