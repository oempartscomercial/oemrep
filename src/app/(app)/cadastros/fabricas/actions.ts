"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { obterUsuarioLogado } from "@/lib/sessao";
import { validarDadosFabrica } from "@/domain/cadastro/fabrica";
import { normalizarCnpj } from "@/domain/cadastro/cnpj";
import { compararCampos } from "@/domain/auditoria/evento";
import { registrarAlteracoes } from "@/lib/auditoria";

export async function criarFabrica(formData: FormData): Promise<{ erros: string[] }> {
  const ator = await obterUsuarioLogado();
  if (!ator) return { erros: ["Sessão expirada. Faça login novamente."] };
  if (ator.perfil !== "ADMIN") return { erros: ["Apenas ADMIN pode cadastrar fábricas."] };

  const nome = String(formData.get("nome") ?? "");
  const cnpj = String(formData.get("cnpj") ?? "");

  const erros = validarDadosFabrica({ nome, cnpj });
  if (erros.length > 0) return { erros };

  const cnpjNormalizado = normalizarCnpj(cnpj);

  // O CNPJ é @unique no banco. Sem este aviso, o segundo cadastro estourava P2002 fora de
  // qualquer try, caía na tela de erro do Next e perdia o formulário digitado.
  const existente = await prisma.fabrica.findUnique({ where: { cnpj: cnpjNormalizado } });
  if (existente) return { erros: ["Já existe uma fábrica com este CNPJ."] };

  await prisma.$transaction(async (tx) => {
    const criada = await tx.fabrica.create({ data: { nome, cnpj: cnpjNormalizado } });
    await registrarAlteracoes(
      compararCampos("Fabrica", criada.id, ator.id, {}, { nome: criada.nome, cnpj: criada.cnpj }),
      tx,
    );
  });

  revalidatePath("/cadastros/fabricas");
  return { erros: [] };
}
