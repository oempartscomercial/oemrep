"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { obterUsuarioLogado } from "@/lib/sessao";
import { podeAcessarFabrica } from "@/lib/authz";
import { validarDadosPedido, type ItemPedidoInput } from "@/domain/pedido/pedido";
import { compararCampos } from "@/domain/auditoria/evento";
import { registrarEfeitosDoPedido } from "@/lib/pedido-lancado";

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
    return {
      erros: ["Você não tem permissão para criar pedidos nesta fábrica."],
    };
  }
  const fabrica = await prisma.fabrica.findUnique({ where: { id: fabricaId } });
  if (!fabrica?.ativo) return { erros: ["Esta fábrica está desativada."] };

  // Pedido, auditoria e efeitos no cadastro da empresa gravam juntos ou nada grava (regra 4).
  try {
    await prisma.$transaction(async (tx) => {
      const pedido = await tx.pedido.create({
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

      await tx.eventoAuditoria.createMany({
        data: compararCampos(
          "Pedido",
          pedido.id,
          usuario.id,
          {},
          {
            numero: pedido.numero,
            semNumero: pedido.semNumero,
            fabricaId,
            clienteId,
          },
        ),
      });
      await registrarEfeitosDoPedido(tx, pedido);
    });
  } catch {
    return {
      erros: ["Falha ao gravar o pedido. Nada foi salvo — tente novamente."],
    };
  }

  revalidatePath("/pedidos");
  return { erros: [] };
}
