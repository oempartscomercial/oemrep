"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { obterUsuarioLogado } from "@/lib/sessao";
import { podeAcessarFabrica } from "@/lib/authz";
import { validarDadosPedido } from "@/domain/pedido/pedido";
import { normalizarExtracao, type ItemRevisao } from "@/domain/importacao/pdf";
import { compararCampos } from "@/domain/auditoria/evento";
import { registrarAlteracoes } from "@/lib/auditoria";
import { guardarPdf } from "@/lib/storage";
import { extrairPedidoDoTextoPdf, ExtracaoPdfSemTexto } from "@/lib/extracao-pdf-texto";

export type RascunhoPdf = {
  importacaoId: string;
  cabecalho: { numeroPedido: string; data: string | null };
  fabrica: { id: string; nome: string } | null;
  cliente: { id: string; nomeFantasia: string } | null;
  fabricaCnpj: string;
  clienteCnpj: string;
  itens: ItemRevisao[];
  conferencia: ReturnType<typeof normalizarExtracao>["conferencia"];
};

/**
 * Passo 1: recebe o PDF, guarda o arquivo, lê os itens pela IA e abre um rascunho durável.
 * A tela de revisão trabalha em cima do que isto devolve; nada é gravado como pedido ainda.
 */
export async function iniciarExtracaoPdf(formData: FormData): Promise<{ erro?: string; rascunho?: RascunhoPdf }> {
  const usuario = await obterUsuarioLogado();
  if (!usuario) return { erro: "Sessão expirada. Faça login novamente." };

  const arquivo = formData.get("arquivo") as File | null;
  if (!arquivo || arquivo.size === 0) return { erro: "Selecione um arquivo PDF." };
  if (arquivo.type && arquivo.type !== "application/pdf") return { erro: "Envie um arquivo PDF." };

  const buffer = Buffer.from(await arquivo.arrayBuffer());

  // Lê os itens da camada de texto do PDF (grátis, offline). Isto tem de dar certo para
  // o fluxo seguir; falha em PDF escaneado, que a mensagem explica.
  let bruta;
  try {
    bruta = await extrairPedidoDoTextoPdf(buffer);
  } catch (erro) {
    if (erro instanceof ExtracaoPdfSemTexto) return { erro: erro.message };
    return { erro: "Não foi possível ler o PDF. Confira se é o arquivo do pedido." };
  }

  // Guardar o arquivo é o passo bônus: se o armazenamento não está configurado, a
  // importação segue sem reter o PDF em vez de travar.
  let arquivoImportadoId: string | null = null;
  try {
    const guardado = await guardarPdf(buffer, arquivo.name);
    const arquivoImportado = await prisma.arquivoImportado.create({
      data: {
        nomeOriginal: arquivo.name,
        caminhoStorage: guardado.caminho,
        tamanhoBytes: guardado.tamanhoBytes,
        mimeType: guardado.mimeType,
        enviadoPorId: usuario.id,
      },
    });
    arquivoImportadoId = arquivoImportado.id;
  } catch {
    // Sem armazenamento configurado: não retém o PDF, mas a importação continua.
    arquivoImportadoId = null;
  }

  const normalizada = normalizarExtracao(bruta);

  // Casa fábrica e cliente pelo CNPJ lido, respeitando a permissão do operador (ADR-009).
  const [fabrica, cliente] = await Promise.all([
    normalizada.cabecalho.fabricaCnpj
      ? prisma.fabrica.findUnique({ where: { cnpj: normalizada.cabecalho.fabricaCnpj }, select: { id: true, nome: true } })
      : null,
    normalizada.cabecalho.clienteCnpj
      ? prisma.cliente.findUnique({ where: { cnpj: normalizada.cabecalho.clienteCnpj }, select: { id: true, nomeFantasia: true } })
      : null,
  ]);
  const fabricaPermitida = fabrica && podeAcessarFabrica(usuario, fabrica.id) ? fabrica : null;

  const importacao = await prisma.importacaoPedido.create({
    data: {
      arquivoId: arquivoImportadoId,
      estado: "AGUARDANDO_REVISAO",
      extracaoBruta: bruta as object,
      criadoPorId: usuario.id,
      fabricaId: fabricaPermitida?.id ?? null,
      clienteId: cliente?.id ?? null,
    },
  });

  return {
    rascunho: {
      importacaoId: importacao.id,
      cabecalho: {
        numeroPedido: normalizada.cabecalho.numeroPedido,
        data: normalizada.cabecalho.data ? normalizada.cabecalho.data.toISOString().slice(0, 10) : null,
      },
      fabrica: fabricaPermitida,
      cliente,
      fabricaCnpj: normalizada.cabecalho.fabricaCnpj,
      clienteCnpj: normalizada.cabecalho.clienteCnpj,
      itens: normalizada.itens,
      conferencia: normalizada.conferencia,
    },
  };
}

type ItemRevisado = { referencia: string; descricao: string; quantidade: number; valorUnitario: number };

export type DadosConfirmacaoPdf = {
  importacaoId: string;
  fabricaId: string;
  clienteId: string;
  numero: string;
  semNumero: boolean;
  itens: ItemRevisado[];
};

/**
 * Passo 2: grava o pedido a partir do que o operador revisou. Pedido, itens, vínculo ao
 * arquivo-fonte, transição do rascunho e auditoria (cabeçalho E itens) numa única
 * transação — se qualquer parte falhar, nada é salvo.
 */
export async function confirmarImportacaoPdf(dados: DadosConfirmacaoPdf): Promise<{ erros: string[] }> {
  const erros = validarDadosPedido({
    numero: dados.numero,
    semNumero: dados.semNumero,
    fabricaId: dados.fabricaId,
    clienteId: dados.clienteId,
    itens: dados.itens,
  });
  if (erros.length > 0) return { erros };

  const usuario = await obterUsuarioLogado();
  if (!usuario) return { erros: ["Sessão expirada. Faça login novamente."] };

  if (!podeAcessarFabrica(usuario, dados.fabricaId)) {
    return { erros: ["Você não tem permissão para importar pedidos para esta fábrica."] };
  }

  const importacao = await prisma.importacaoPedido.findUnique({ where: { id: dados.importacaoId } });
  if (!importacao) return { erros: ["Rascunho de importação não encontrado. Recarregue e tente de novo."] };
  if (importacao.estado === "CONFIRMADA") return { erros: ["Esta importação já foi confirmada."] };

  try {
    await prisma.$transaction(async (tx) => {
      const pedido = await tx.pedido.create({
        data: {
          numero: dados.semNumero ? null : dados.numero,
          semNumero: dados.semNumero,
          origem: "PDF",
          fabricaId: dados.fabricaId,
          clienteId: dados.clienteId,
          arquivoOrigemId: importacao.arquivoId,
          itens: {
            create: dados.itens.map((item) => ({
              referencia: item.referencia,
              descricao: item.descricao,
              quantidadePedida: item.quantidade,
              valorUnitario: item.valorUnitario,
            })),
          },
        },
        include: { itens: true },
      });

      await tx.importacaoPedido.update({
        where: { id: importacao.id },
        data: { estado: "CONFIRMADA", pedidoId: pedido.id, revisaoAtual: dados as unknown as object },
      });

      const eventos = compararCampos(
        "Pedido",
        pedido.id,
        usuario.id,
        {},
        { numero: pedido.numero, semNumero: pedido.semNumero, origem: "PDF" },
      );
      // Auditoria item a item: com PDF, os valores vieram de leitura falível e foram
      // corrigidos à mão, então é aqui que a auditoria passa a valer de verdade.
      for (const item of pedido.itens) {
        eventos.push(
          ...compararCampos(
            "ItemPedido",
            item.id,
            usuario.id,
            {},
            {
              referencia: item.referencia,
              quantidadePedida: item.quantidadePedida,
              valorUnitario: String(item.valorUnitario),
            },
          ),
        );
      }
      await registrarAlteracoes(eventos, tx);
    });
  } catch {
    return { erros: ["Nada foi salvo — tente novamente."] };
  }

  revalidatePath("/pedidos");
  return { erros: [] };
}

/** Descarta um rascunho que o operador decidiu não confirmar. */
export async function descartarRascunhoPdf(importacaoId: string): Promise<void> {
  const usuario = await obterUsuarioLogado();
  if (!usuario) return;
  await prisma.importacaoPedido.updateMany({
    where: { id: importacaoId, criadoPorId: usuario.id, estado: "AGUARDANDO_REVISAO" },
    data: { estado: "DESCARTADA" },
  });
}
