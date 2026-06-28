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
