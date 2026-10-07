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

  const cnpjNormalizado = normalizarCnpj(cnpj) || null;
  if (cnpjNormalizado && (await prisma.cliente.findUnique({ where: { cnpj: cnpjNormalizado } }))) {
    return { erros: ["Já existe uma empresa com este CNPJ."] };
  }

  const fabricas = await prisma.fabrica.findMany({ where: { id: { in: fabricasIds } }, select: { id: true } });
  if (fabricas.length !== fabricasIds.length) {
    return { erros: ["Uma das fábricas selecionadas não existe mais. Recarregue a página."] };
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

export async function editarCliente(id: string, formData: FormData): Promise<{ erros: string[] }> {
  const usuario = await obterUsuarioLogado();
  if (!usuario) return { erros: ["Sessão expirada. Faça login novamente."] };
  if (usuario.perfil !== "ADMIN") return { erros: ["Apenas ADMIN pode alterar clientes."] };

  const nomeFantasia = String(formData.get("nomeFantasia") ?? "");
  const cnpj = String(formData.get("cnpj") ?? "");
  const fabricasIds = formData.getAll("fabricasIds").map(String).sort();

  const erros = validarDadosCliente({ nomeFantasia, cnpj, fabricasIds });
  if (erros.length > 0) return { erros };

  const atual = await prisma.cliente.findUnique({ where: { id }, include: { fabricas: true } });
  if (!atual) return { erros: ["Cliente não encontrado."] };
  const cnpjNormalizado = normalizarCnpj(cnpj) || null;
  if (cnpjNormalizado) {
    const dono = await prisma.cliente.findUnique({ where: { cnpj: cnpjNormalizado } });
    if (dono && dono.id !== id) return { erros: ["Já existe uma empresa com este CNPJ."] };
  }
  const fabricasAtuais = atual.fabricas.map((f) => f.fabricaId).sort();

  await prisma.$transaction(async (tx) => {
    await tx.cliente.update({ where: { id }, data: { nomeFantasia, cnpj: cnpjNormalizado } });
    // Vínculos removidos saem; os novos entram com o padrão (RN23). Os mantidos
    // preservam a configuração de estoque e acesso que já tinham.
    await tx.clienteFabrica.deleteMany({ where: { clienteId: id, fabricaId: { notIn: fabricasIds } } });
    await tx.clienteFabrica.createMany({
      data: fabricasIds.filter((f) => !fabricasAtuais.includes(f)).map((fabricaId) => ({ clienteId: id, fabricaId })),
    });
    await tx.eventoAuditoria.createMany({
      data: compararCampos(
        "Cliente",
        id,
        usuario.id,
        { nomeFantasia: atual.nomeFantasia, cnpj: atual.cnpj, fabricasIds: fabricasAtuais.join(",") },
        { nomeFantasia, cnpj: cnpjNormalizado, fabricasIds: fabricasIds.join(",") },
      ),
    });
  });

  revalidatePath("/cadastros/clientes");
  return { erros: [] };
}
