"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { obterUsuarioLogado } from "@/lib/sessao";
import { podeAcessarFabrica } from "@/lib/authz";
import { extrairItensDaPlanilha, type ItemExtraido } from "@/domain/importacao/excel";
import { validarDadosPedido } from "@/domain/pedido/pedido";
import { compararCampos } from "@/domain/auditoria/evento";

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

  if (!podeAcessarFabrica(usuario, dados.fabricaId)) {
    return { erros: ["Você não tem permissão para importar pedidos para esta fábrica."] };
  }

  // Pedido e auditoria na mesma transação: ou os dois gravam, ou nada grava (regra 4).
  // O catch existe para a tela receber uma mensagem — sem ele a Server Action rejeita
  // e o usuário não vê nada acontecer.
  try {
    await prisma.$transaction(async (tx) => {
      const pedido = await tx.pedido.create({
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

      const eventos = compararCampos(
        "Pedido",
        pedido.id,
        usuario.id,
        {},
        { numero: pedido.numero, semNumero: pedido.semNumero, origem: "EXCEL" },
      );
      if (eventos.length > 0) {
        await tx.eventoAuditoria.createMany({ data: eventos });
      }
    });
  } catch {
    return { erros: ["Falha ao gravar o pedido. Nada foi salvo — tente novamente."] };
  }

  revalidatePath("/pedidos");
  return { erros: [] };
}
