"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { obterUsuarioLogado } from "@/lib/sessao";
import { validarDadosFabrica } from "@/domain/cadastro/fabrica";
import { normalizarCnpj } from "@/domain/cadastro/cnpj";
import { compararCampos } from "@/domain/auditoria/evento";

export async function criarFabrica(formData: FormData): Promise<{ erros: string[] }> {
  const usuario = await obterUsuarioLogado();
  if (!usuario) return { erros: ["Sessão expirada. Faça login novamente."] };
  if (usuario.perfil !== "ADMIN") return { erros: ["Apenas ADMIN pode cadastrar fábricas."] };

  const nome = String(formData.get("nome") ?? "");
  const cnpj = String(formData.get("cnpj") ?? "");

  const erros = validarDadosFabrica({ nome, cnpj });
  if (erros.length > 0) return { erros };

  const cnpjNormalizado = normalizarCnpj(cnpj);
  if (await prisma.fabrica.findUnique({ where: { cnpj: cnpjNormalizado } })) {
    return { erros: ["Já existe uma fábrica com este CNPJ."] };
  }

  await prisma.$transaction(async (tx) => {
    const fabrica = await tx.fabrica.create({ data: { nome, cnpj: cnpjNormalizado } });
    await tx.eventoAuditoria.createMany({
      data: compararCampos("Fabrica", fabrica.id, usuario.id, {}, { nome: fabrica.nome, cnpj: fabrica.cnpj }),
    });
  });

  revalidatePath("/cadastros/fabricas");
  return { erros: [] };
}

const SO_ADMIN = "Apenas ADMIN pode alterar fábricas.";

export async function editarFabrica(id: string, formData: FormData): Promise<{ erros: string[] }> {
  const usuario = await obterUsuarioLogado();
  if (!usuario) return { erros: ["Sessão expirada. Faça login novamente."] };
  if (usuario.perfil !== "ADMIN") return { erros: [SO_ADMIN] };

  const nome = String(formData.get("nome") ?? "");
  const cnpj = String(formData.get("cnpj") ?? "");
  const erros = validarDadosFabrica({ nome, cnpj });
  if (erros.length > 0) return { erros };

  const atual = await prisma.fabrica.findUnique({ where: { id } });
  if (!atual) return { erros: ["Fábrica não encontrada."] };
  const cnpjNormalizado = normalizarCnpj(cnpj);
  const dono = await prisma.fabrica.findUnique({ where: { cnpj: cnpjNormalizado } });
  if (dono && dono.id !== id) return { erros: ["Já existe uma fábrica com este CNPJ."] };

  await prisma.$transaction(async (tx) => {
    await tx.fabrica.update({ where: { id }, data: { nome, cnpj: cnpjNormalizado } });
    await tx.eventoAuditoria.createMany({
      data: compararCampos("Fabrica", id, usuario.id, { nome: atual.nome, cnpj: atual.cnpj }, { nome, cnpj: cnpjNormalizado }),
    });
  });

  revalidatePath("/cadastros/fabricas");
  return { erros: [] };
}

export async function alterarAtivoFabrica(id: string, ativo: boolean): Promise<{ erros: string[] }> {
  const usuario = await obterUsuarioLogado();
  if (!usuario) return { erros: ["Sessão expirada. Faça login novamente."] };
  if (usuario.perfil !== "ADMIN") return { erros: [SO_ADMIN] };

  const atual = await prisma.fabrica.findUnique({ where: { id } });
  if (!atual) return { erros: ["Fábrica não encontrada."] };

  await prisma.$transaction(async (tx) => {
    await tx.fabrica.update({ where: { id }, data: { ativo } });
    await tx.eventoAuditoria.createMany({
      data: compararCampos("Fabrica", id, usuario.id, { ativo: atual.ativo }, { ativo }),
    });
  });

  revalidatePath("/cadastros/fabricas");
  return { erros: [] };
}
