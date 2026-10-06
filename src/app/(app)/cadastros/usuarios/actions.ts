"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { obterUsuarioLogado } from "@/lib/sessao";
import { validarDadosUsuario } from "@/domain/cadastro/usuario";
import type { PerfilUsuario } from "@/lib/authz";
import { compararCampos } from "@/domain/auditoria/evento";
import { registrarAlteracoes } from "@/lib/auditoria";

export async function criarUsuario(formData: FormData): Promise<{ erros: string[] }> {
  const ator = await obterUsuarioLogado();
  if (!ator) return { erros: ["Sessão expirada. Faça login novamente."] };
  if (ator.perfil !== "ADMIN") return { erros: ["Apenas ADMIN pode cadastrar usuários."] };

  const nome = String(formData.get("nome") ?? "");
  const email = String(formData.get("email") ?? "");
  const perfil = String(formData.get("perfil") ?? "OPERADOR") as PerfilUsuario;
  const fabricasIds = formData.getAll("fabricasIds").map(String);

  const erros = validarDadosUsuario({ nome, email, perfil, fabricasIds });
  if (erros.length > 0) return { erros };

  const existente = await prisma.usuario.findUnique({ where: { email } });
  if (existente) return { erros: ["Já existe um usuário com este e-mail."] };

  // ADR-010: cria só o registro de domínio (sem login); o vínculo ao Supabase
  // Auth acontece no 1º acesso, casado pelo e-mail.
  const usuario = await prisma.usuario.create({
    data: { nome, email, perfil },
  });

  await prisma.usuarioFabrica.createMany({
    data: fabricasIds.map((fabricaId) => ({ usuarioId: usuario.id, fabricaId })),
  });

  await registrarAlteracoes(
    compararCampos(
      "Usuario",
      usuario.id,
      ator.id,
      {},
      {
        nome: usuario.nome,
        email: usuario.email,
        perfil: usuario.perfil,
        fabricasIds: fabricasIds.join(","),
      },
    ),
  );

  revalidatePath("/cadastros/usuarios");
  return { erros: [] };
}

const SO_ADMIN = "Apenas ADMIN pode alterar usuários.";

// E-mail não muda: é a chave do vínculo com o login do Supabase (ADR-010).
export async function editarUsuario(id: string, formData: FormData): Promise<{ erros: string[] }> {
  const ator = await obterUsuarioLogado();
  if (!ator) return { erros: ["Sessão expirada. Faça login novamente."] };
  if (ator.perfil !== "ADMIN") return { erros: [SO_ADMIN] };

  const atual = await prisma.usuario.findUnique({ where: { id }, include: { fabricas: true } });
  if (!atual) return { erros: ["Usuário não encontrado."] };

  const nome = String(formData.get("nome") ?? "");
  const perfil = String(formData.get("perfil") ?? "OPERADOR") as PerfilUsuario;
  const fabricasIds = formData.getAll("fabricasIds").map(String).sort();

  const erros = validarDadosUsuario({ nome, email: atual.email, perfil, fabricasIds });
  if (erros.length > 0) return { erros };
  if (id === ator.id && perfil !== "ADMIN") return { erros: ["Você não pode tirar o próprio perfil de ADMIN."] };

  const fabricasAtuais = atual.fabricas.map((f) => f.fabricaId).sort();
  await prisma.$transaction(async (tx) => {
    await tx.usuario.update({ where: { id }, data: { nome, perfil } });
    await tx.usuarioFabrica.deleteMany({ where: { usuarioId: id } });
    await tx.usuarioFabrica.createMany({ data: fabricasIds.map((fabricaId) => ({ usuarioId: id, fabricaId })) });
    await tx.eventoAuditoria.createMany({
      data: compararCampos(
        "Usuario",
        id,
        ator.id,
        { nome: atual.nome, perfil: atual.perfil, fabricasIds: fabricasAtuais.join(",") },
        { nome, perfil, fabricasIds: fabricasIds.join(",") },
      ),
    });
  });

  revalidatePath("/cadastros/usuarios");
  return { erros: [] };
}

export async function alterarAtivoUsuario(id: string, ativo: boolean): Promise<{ erros: string[] }> {
  const ator = await obterUsuarioLogado();
  if (!ator) return { erros: ["Sessão expirada. Faça login novamente."] };
  if (ator.perfil !== "ADMIN") return { erros: [SO_ADMIN] };
  if (id === ator.id && !ativo) return { erros: ["Você não pode desativar o próprio acesso."] };

  const atual = await prisma.usuario.findUnique({ where: { id } });
  if (!atual) return { erros: ["Usuário não encontrado."] };

  await prisma.$transaction(async (tx) => {
    await tx.usuario.update({ where: { id }, data: { ativo } });
    await tx.eventoAuditoria.createMany({ data: compararCampos("Usuario", id, ator.id, { ativo: atual.ativo }, { ativo }) });
  });

  revalidatePath("/cadastros/usuarios");
  return { erros: [] };
}
