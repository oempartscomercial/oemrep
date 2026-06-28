"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { obterUsuarioLogado } from "@/lib/sessao";
import { validarDadosCliente } from "@/domain/cadastro/cliente";
import { normalizarCnpj } from "@/domain/cadastro/cnpj";
import { compararCampos } from "@/domain/auditoria/evento";
import { registrarAlteracoes } from "@/lib/auditoria";

export async function criarCliente(formData: FormData): Promise<{ erros: string[] }> {
  const nomeFantasia = String(formData.get("nomeFantasia") ?? "");
  const cnpj = String(formData.get("cnpj") ?? "");
  const fabricasIds = formData.getAll("fabricasIds").map(String);
  const tipoConfirmacaoEstoque = String(formData.get("tipoConfirmacaoEstoque") ?? "PRESUMIDA") as
    | "AUTOMATICA"
    | "PRESUMIDA";
  const flagAcessoSistema = formData.get("flagAcessoSistema") === "on";

  const erros = validarDadosCliente({ nomeFantasia, cnpj, fabricasIds });
  if (erros.length > 0) return { erros };

  const usuario = await obterUsuarioLogado();
  if (!usuario) return { erros: ["Sessão expirada. Faça login novamente."] };

  const cliente = await prisma.cliente.create({
    data: { nomeFantasia, cnpj: normalizarCnpj(cnpj) },
  });

  // RN23: cada vínculo Cliente×Fábrica é independente.
  await prisma.clienteFabrica.createMany({
    data: fabricasIds.map((fabricaId) => ({
      clienteId: cliente.id,
      fabricaId,
      flagAcessoSistema,
      tipoConfirmacaoEstoque,
    })),
  });

  await registrarAlteracoes(
    compararCampos(
      "Cliente",
      cliente.id,
      usuario.id,
      {},
      { nomeFantasia: cliente.nomeFantasia, cnpj: cliente.cnpj, fabricasIds: fabricasIds.join(",") },
    ),
  );

  revalidatePath("/cadastros/clientes");
  return { erros: [] };
}
