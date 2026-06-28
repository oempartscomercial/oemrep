"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { obterUsuarioLogado } from "@/lib/sessao";
import { validarDadosFabrica } from "@/domain/cadastro/fabrica";
import { normalizarCnpj } from "@/domain/cadastro/cnpj";
import { compararCampos } from "@/domain/auditoria/evento";
import { registrarAlteracoes } from "@/lib/auditoria";

export async function criarFabrica(formData: FormData): Promise<{ erros: string[] }> {
  const nome = String(formData.get("nome") ?? "");
  const cnpj = String(formData.get("cnpj") ?? "");

  const erros = validarDadosFabrica({ nome, cnpj });
  if (erros.length > 0) return { erros };

  const usuario = await obterUsuarioLogado();
  if (!usuario) return { erros: ["Sessão expirada. Faça login novamente."] };

  const fabrica = await prisma.fabrica.create({
    data: { nome, cnpj: normalizarCnpj(cnpj) },
  });

  await registrarAlteracoes(
    compararCampos("Fabrica", fabrica.id, usuario.id, {}, { nome: fabrica.nome, cnpj: fabrica.cnpj }),
  );

  revalidatePath("/cadastros/fabricas");
  return { erros: [] };
}
