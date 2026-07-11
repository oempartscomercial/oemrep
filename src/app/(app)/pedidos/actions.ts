"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { obterUsuarioLogado } from "@/lib/sessao";
import { podeAcessarFabrica } from "@/lib/authz";
import { validarDadosPedido, type ItemPedidoInput } from "@/domain/pedido/pedido";
import { compararCampos } from "@/domain/auditoria/evento";
import { registrarAlteracoes } from "@/lib/auditoria";

function lerItensDoFormulario(formData: FormData): ItemPedidoInput[] {
  const referencias = formData.getAll("referencia").map(String);
  const descricoes = formData.getAll("descricao").map(String);
  const quantidades = formData.getAll("quantidade").map(Number);
  const valores = formData.getAll("valorUnitario").map(Number);

  return referencias.map((referencia, i) => ({
    referencia,
    descricao: descricoes[i] ?? "",
    quantidade: quantidades[i] ?? 0,
    valorUnitario: valores[i] ?? 0,
  }));
}

export async function criarPedidoManual(formData: FormData): Promise<{ erros: string[] }> {
  const numero = String(formData.get("numero") ?? "");
  const semNumero = formData.get("semNumero") === "on";
  const fabricaId = String(formData.get("fabricaId") ?? "");
  const clienteId = String(formData.get("clienteId") ?? "");
  const itens = lerItensDoFormulario(formData);

  const erros = validarDadosPedido({ numero, semNumero, fabricaId, clienteId, itens });
  if (erros.length > 0) return { erros };

  const usuario = await obterUsuarioLogado();
  if (!usuario) return { erros: ["Sessão expirada. Faça login novamente."] };

  if (!podeAcessarFabrica(usuario, fabricaId)) {
    return { erros: ["Você não tem permissão para criar pedidos nesta fábrica."] };
  }

  const pedido = await prisma.pedido.create({
    data: {
      numero: semNumero ? null : numero,
      semNumero,
      origem: "MANUAL",
      fabricaId,
      clienteId,
      itens: {
        create: itens.map((item) => ({
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
      { numero: pedido.numero, semNumero: pedido.semNumero, fabricaId, clienteId },
    ),
  );

  revalidatePath("/pedidos");
  return { erros: [] };
}
