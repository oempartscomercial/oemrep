"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { obterUsuarioLogado } from "@/lib/sessao";
import { extrairItensDaPlanilha, type ItemExtraido } from "@/domain/importacao/excel";
import { validarDadosPedido } from "@/domain/pedido/pedido";
import { compararCampos } from "@/domain/auditoria/evento";
import { registrarAlteracoes } from "@/lib/auditoria";

export async function analisarPlanilha(
  formData: FormData,
): Promise<{ erro?: string; itens?: ItemExtraido[] }> {
  const arquivo = formData.get("arquivo") as File | null;
  if (!arquivo || arquivo.size === 0) return { erro: "Selecione um arquivo." };

  const buffer = Buffer.from(await arquivo.arrayBuffer());
  try {
    const itens = await extrairItensDaPlanilha(buffer);
    if (itens.length === 0) return { erro: "Nenhum item encontrado na planilha." };
    return { itens };
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : "Falha ao ler a planilha." };
  }
}

type DadosConfirmacao = {
  fabricaId: string;
  clienteId: string;
  numero: string;
  semNumero: boolean;
  itens: ItemExtraido[];
};

export async function confirmarImportacao(dados: DadosConfirmacao): Promise<{ erros: string[] }> {
  const erros = validarDadosPedido({
    numero: dados.numero,
    semNumero: dados.semNumero,
    fabricaId: dados.fabricaId,
    clienteId: dados.clienteId,
    itens: dados.itens.map((item) => ({
      referencia: item.referencia,
      descricao: item.descricao,
      quantidade: item.quantidade,
      valorUnitario: item.valorUnitario,
    })),
  });
  if (erros.length > 0) return { erros };

  const usuario = await obterUsuarioLogado();
  if (!usuario) return { erros: ["Sessão expirada. Faça login novamente."] };

  const pedido = await prisma.pedido.create({
    data: {
      numero: dados.semNumero ? null : dados.numero,
      semNumero: dados.semNumero,
      origem: "EXCEL",
      fabricaId: dados.fabricaId,
      clienteId: dados.clienteId,
      itens: {
        create: dados.itens.map((item) => ({
          referencia: item.referencia,
          descricao: item.descricao,
          quantidadePedida: item.quantidade,
          valorUnitario: item.valorUnitario,
        })),
      },
    },
  });

  await registrarAlteracoes(
    compararCampos(
      "Pedido",
      pedido.id,
      usuario.id,
      {},
      { numero: pedido.numero, semNumero: pedido.semNumero, origem: "EXCEL" },
    ),
  );

  revalidatePath("/pedidos");
  return { erros: [] };
}
