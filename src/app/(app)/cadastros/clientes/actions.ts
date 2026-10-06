"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { obterUsuarioLogado } from "@/lib/sessao";
import { validarDadosCliente } from "@/domain/cadastro/cliente";
import { normalizarCnpj } from "@/domain/cadastro/cnpj";
import { compararCampos } from "@/domain/auditoria/evento";

export async function criarCliente(formData: FormData): Promise<{ erros: string[] }> {
  const usuario = await obterUsuarioLogado();
  if (!usuario) return { erros: ["Sessão expirada. Faça login novamente."] };
  if (usuario.perfil !== "ADMIN") return { erros: ["Apenas ADMIN pode cadastrar clientes."] };

  const nomeFantasia = String(formData.get("nomeFantasia") ?? "");
  const cnpj = String(formData.get("cnpj") ?? "");
  const fabricasIds = formData.getAll("fabricasIds").map(String);
  const tipoConfirmacaoEstoque = String(formData.get("tipoConfirmacaoEstoque") ?? "PRESUMIDA") as
    | "AUTOMATICA"
    | "PRESUMIDA";
  const flagAcessoSistema = formData.get("flagAcessoSistema") === "on";

  const erros = validarDadosCliente({ nomeFantasia, cnpj, fabricasIds });
  if (erros.length > 0) return { erros };

  const cnpjNormalizado = normalizarCnpj(cnpj);
  if (await prisma.cliente.findUnique({ where: { cnpj: cnpjNormalizado } })) {
    return { erros: ["Já existe uma empresa com este CNPJ."] };
  }

  await prisma.$transaction(async (tx) => {
    const cliente = await tx.cliente.create({ data: { nomeFantasia, cnpj: cnpjNormalizado } });

    // RN23: cada vínculo Cliente×Fábrica é independente.
    await tx.clienteFabrica.createMany({
      data: fabricasIds.map((fabricaId) => ({
        clienteId: cliente.id,
        fabricaId,
        flagAcessoSistema,
        tipoConfirmacaoEstoque,
      })),
    });

    await tx.eventoAuditoria.createMany({
      data: compararCampos(
        "Cliente",
        cliente.id,
        usuario.id,
        {},
        { nomeFantasia: cliente.nomeFantasia, cnpj: cliente.cnpj, fabricasIds: fabricasIds.join(",") },
      ),
    });
  });

  revalidatePath("/cadastros/clientes");
  return { erros: [] };
}
