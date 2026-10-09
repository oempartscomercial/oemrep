"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { obterUsuarioLogado } from "@/lib/sessao";
import { podeAcessarFabrica } from "@/lib/authz";
import { validarDadosPedido, type ItemPedidoInput } from "@/domain/pedido/pedido";
import { compararCampos } from "@/domain/auditoria/evento";
import { registrarEfeitosDoPedido } from "@/lib/pedido-lancado";
import { Prisma } from "@prisma/client";
import { validarPedidoRapido, type DadosPedidoRapido } from "@/domain/pedido/rapido";
import { formatarReais } from "@/domain/formato/moeda";

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

export type ClienteEncontrado = { id: string; nome: string; cnpj: string | null; cidade: string | null; uf: string | null };

/** Busca de cliente para o pedido rápido: por nome ou CNPJ, em toda a base (cliente novo de uma fábrica ainda não tem vínculo). */
export async function buscarClientesParaPedido(termo: string): Promise<ClienteEncontrado[]> {
  const usuario = await obterUsuarioLogado();
  if (!usuario) return [];
  const limpo = termo.trim();
  if (limpo.length < 2) return [];
  const digitos = limpo.replace(/\D/g, "");
  const clientes = await prisma.cliente.findMany({
    where: {
      OR: [
        { nomeFantasia: { contains: limpo, mode: "insensitive" } },
        ...(digitos.length >= 4 ? [{ cnpj: { contains: digitos } }] : []),
      ],
    },
    select: { id: true, nomeFantasia: true, cnpj: true, cidade: true, uf: true },
    orderBy: { nomeFantasia: "asc" },
    take: 8,
  });
  return clientes.map((c) => ({ id: c.id, nome: c.nomeFantasia, cnpj: c.cnpj, cidade: c.cidade, uf: c.uf }));
}

/**
 * Pedido rápido (sem itens): o que chegou por print de WhatsApp. Cria o cliente na hora se
 * for novo, e o pedido nasce SEM_NFE com o valor informado, para entrar na conta do "sem nota".
 */
export async function criarPedidoRapido(dados: DadosPedidoRapido): Promise<{ erros: string[]; pedidoId?: string; resumo?: string }> {
  const { erros, valido } = validarPedidoRapido(dados);
  if (!valido) return { erros };

  const usuario = await obterUsuarioLogado();
  if (!usuario) return { erros: ["Sessão expirada. Faça login novamente."] };
  if (!podeAcessarFabrica(usuario, valido.fabricaId)) return { erros: ["Você não tem permissão para registrar pedidos nesta fábrica."] };
  const fabrica = await prisma.fabrica.findUnique({ where: { id: valido.fabricaId } });
  if (!fabrica?.ativo) return { erros: ["Esta fábrica está desativada."] };

  try {
    const { pedido, clienteNome } = await prisma.$transaction(async (tx) => {
      let clienteId = valido.clienteId;
      let clienteNome = "";
      if (!clienteId && valido.novoCliente) {
        // CNPJ já cadastrado: usa a empresa que existe em vez de duplicar.
        const existente = valido.novoCliente.cnpj ? await tx.cliente.findUnique({ where: { cnpj: valido.novoCliente.cnpj } }) : null;
        const cliente =
          existente ??
          (await tx.cliente.create({ data: { nomeFantasia: valido.novoCliente.nome, cnpj: valido.novoCliente.cnpj, origem: "Pedido rápido" } }));
        if (!existente) {
          await tx.eventoAuditoria.createMany({
            data: compararCampos("Cliente", cliente.id, usuario.id, {}, { nomeFantasia: cliente.nomeFantasia, cnpj: cliente.cnpj }),
          });
        }
        clienteId = cliente.id;
        clienteNome = cliente.nomeFantasia;
      } else {
        const cliente = await tx.cliente.findUniqueOrThrow({ where: { id: clienteId! } });
        clienteNome = cliente.nomeFantasia;
      }

      const pedido = await tx.pedido.create({
        data: {
          numero: valido.numero,
          semNumero: !valido.numero,
          origem: "RAPIDO",
          fabricaId: valido.fabricaId,
          clienteId: clienteId!,
          numeroCliente: valido.numeroCliente,
          dataPedido: valido.dataPedido,
          valorTotalDeclarado: valido.valorTotal,
          observacao: valido.observacao,
        },
      });
      await tx.eventoAuditoria.createMany({
        data: compararCampos("Pedido", pedido.id, usuario.id, {}, {
          numero: pedido.numero,
          origem: "RAPIDO",
          fabricaId: pedido.fabricaId,
          clienteId: pedido.clienteId,
          valorTotalDeclarado: String(valido.valorTotal),
        }),
      });
      await registrarEfeitosDoPedido(tx, pedido);
      return { pedido, clienteNome };
    });

    revalidatePath("/pedidos");
    revalidatePath("/");
    return { erros: [], pedidoId: pedido.id, resumo: `${fabrica.nome} · ${clienteNome} · ${formatarReais(valido.valorTotal)}` };
  } catch (erro) {
    if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002") {
      return { erros: ["Já existe um pedido com este número para este cliente nesta fábrica."] };
    }
    return { erros: ["Falha ao registrar o pedido. Nada foi salvo — tente novamente."] };
  }
}

/** Desfaz um pedido rápido recém-registrado (toast "Desfazer"): só enquanto não tem item nem nota. */
export async function desfazerPedidoRapido(pedidoId: string): Promise<{ erros: string[] }> {
  const usuario = await obterUsuarioLogado();
  if (!usuario) return { erros: ["Sessão expirada. Faça login novamente."] };
  const pedido = await prisma.pedido.findUnique({
    where: { id: pedidoId },
    include: { _count: { select: { itens: true, notasFiscais: true } } },
  });
  if (!pedido || !podeAcessarFabrica(usuario, pedido.fabricaId)) return { erros: ["Pedido não encontrado."] };
  if (pedido.origem !== "RAPIDO" || pedido._count.itens > 0 || pedido._count.notasFiscais > 0) {
    return { erros: ["Este pedido já tem itens ou nota e não pode mais ser desfeito."] };
  }
  if (Date.now() - pedido.criadoEm.getTime() > 10 * 60 * 1000) {
    return { erros: ["Passou o tempo de desfazer. Abra o pedido para arquivar."] };
  }
  await prisma.$transaction([
    prisma.eventoAuditoria.createMany({
      data: compararCampos("Pedido", pedido.id, usuario.id, { origem: "RAPIDO" }, { origem: "DESFEITO" }),
    }),
    prisma.pedido.delete({ where: { id: pedido.id } }),
  ]);
  revalidatePath("/pedidos");
  revalidatePath("/");
  return { erros: [] };
}
