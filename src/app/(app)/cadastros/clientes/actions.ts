"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { obterUsuarioLogado } from "@/lib/sessao";
import { validarDadosCliente } from "@/domain/cadastro/cliente";
import { normalizarCnpj } from "@/domain/cadastro/cnpj";
import { compararCampos } from "@/domain/auditoria/evento";
import { registrarAlteracoes } from "@/lib/auditoria";

export async function criarCliente(formData: FormData): Promise<{ erros: string[] }> {
  const ator = await obterUsuarioLogado();
  if (!ator) return { erros: ["Sessão expirada. Faça login novamente."] };
  if (ator.perfil !== "ADMIN") return { erros: ["Apenas ADMIN pode cadastrar clientes."] };

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

  const existente = await prisma.cliente.findUnique({ where: { cnpj: cnpjNormalizado } });
  if (existente) return { erros: ["Já existe um cliente com este CNPJ."] };

  const fabricas = await prisma.fabrica.findMany({
    where: { id: { in: fabricasIds } },
    select: { id: true },
  });
  if (fabricas.length !== fabricasIds.length) {
    return { erros: ["Uma das fábricas selecionadas não existe mais. Recarregue a página."] };
  }

  // O cliente e seus vínculos nascem juntos ou não nascem: antes o Cliente era criado
  // primeiro e um erro nos vínculos deixava um cliente órfão, sem fábrica nenhuma.
  await prisma.$transaction(async (tx) => {
    const criado = await tx.cliente.create({
      data: { nomeFantasia, cnpj: cnpjNormalizado },
    });

    // RN23: cada vínculo Cliente×Fábrica é independente.
    await tx.clienteFabrica.createMany({
      data: fabricasIds.map((fabricaId) => ({
        clienteId: criado.id,
        fabricaId,
        flagAcessoSistema,
        tipoConfirmacaoEstoque,
      })),
    });

    await registrarAlteracoes(
      compararCampos(
        "Cliente",
        criado.id,
        ator.id,
        {},
        {
          nomeFantasia: criado.nomeFantasia,
          cnpj: criado.cnpj,
          fabricasIds: fabricasIds.join(","),
        },
      ),
      tx,
    );
  });

  revalidatePath("/cadastros/clientes");
  return { erros: [] };
}
