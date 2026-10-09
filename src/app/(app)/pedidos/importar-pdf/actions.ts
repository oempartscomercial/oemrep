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
import { Prisma } from "@prisma/client";
import { registrarEfeitosDoPedido } from "@/lib/pedido-lancado";
import { cnpjValido, normalizarCnpj } from "@/domain/cadastro/cnpj";

export type PedidoRapidoParecido = { id: string; numero: string | null; data: string; valor: number };

export type RascunhoPdf = {
  importacaoId: string;
  cabecalho: {
    numeroPedido: string;
    data: string | null;
    numeroPedidoCliente: string;
    transportador: string;
    modalidadeFrete: string;
    vendedor: string;
    totalPedido: number | null;
  };
  /** Pedido rápido (sem itens) do mesmo cliente que parece ser este: o operador pode completá-lo. */
  parecido: PedidoRapidoParecido | null;
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
    console.error("Falha ao ler PDF de pedido", erro);
    return { erro: "Não foi possível ler este PDF. Confira se é o PDF original do pedido ou registre como pedido rápido." };
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

  const parecido =
    fabricaPermitida && cliente
      ? await acharPedidoRapidoParecido(
          fabricaPermitida.id,
          cliente.id,
          normalizada.cabecalho.totalPedido ?? normalizada.conferencia.totalCalculado,
          normalizada.cabecalho.numeroPedido,
        )
      : null;

  return {
    rascunho: {
      importacaoId: importacao.id,
      cabecalho: {
        numeroPedido: normalizada.cabecalho.numeroPedido,
        data: normalizada.cabecalho.data ? normalizada.cabecalho.data.toISOString().slice(0, 10) : null,
        numeroPedidoCliente: normalizada.cabecalho.numeroPedidoCliente,
        transportador: normalizada.cabecalho.transportador,
        modalidadeFrete: normalizada.cabecalho.modalidadeFrete,
        vendedor: normalizada.cabecalho.vendedor,
        totalPedido: normalizada.cabecalho.totalPedido,
      },
      parecido,
      fabrica: fabricaPermitida,
      cliente,
      fabricaCnpj: normalizada.cabecalho.fabricaCnpj,
      clienteCnpj: normalizada.cabecalho.clienteCnpj,
      itens: normalizada.itens,
      conferencia: normalizada.conferencia,
    },
  };
}

/**
 * Pedido rápido registrado antes do PDF chegar: mesmo cliente e fábrica, ainda sem itens nem
 * nota, e com o mesmo número ou valor até 1% de diferença. É o "print do WhatsApp" que agora
 * chegou em PDF — completar em vez de duplicar.
 */
export async function acharPedidoRapidoParecido(
  fabricaId: string,
  clienteId: string,
  valor: number,
  numero: string,
): Promise<PedidoRapidoParecido | null> {
  const candidatos = await prisma.pedido.findMany({
    where: { fabricaId, clienteId, origem: "RAPIDO", estado: "SEM_NFE", itens: { none: {} }, notasFiscais: { none: {} } },
    orderBy: { criadoEm: "desc" },
    take: 20,
  });
  const achado =
    candidatos.find((p) => numero && p.numero === numero) ??
    candidatos.find((p) => {
      const declarado = Number(p.valorTotalDeclarado ?? 0);
      return declarado > 0 && valor > 0 && Math.abs(declarado - valor) / valor <= 0.01;
    });
  if (!achado) return null;
  return {
    id: achado.id,
    numero: achado.numero,
    data: (achado.dataPedido ?? achado.criadoEm).toISOString().slice(0, 10),
    valor: Number(achado.valorTotalDeclarado ?? 0),
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
  numeroCliente?: string;
  /** AAAA-MM-DD */
  dataPedido?: string | null;
  transportadorPrevisto?: string;
  modalidadeFrete?: string;
  vendedor?: string;
  /** Completa este pedido rápido em vez de criar outro. */
  completarPedidoId?: string | null;
};

/**
 * Passo 2: grava o pedido a partir do que o operador revisou. Pedido, itens, vínculo ao
 * arquivo-fonte, transição do rascunho e auditoria (cabeçalho E itens) numa única
 * transação — se qualquer parte falhar, nada é salvo.
 */
export async function confirmarImportacaoPdf(dados: DadosConfirmacaoPdf): Promise<{ erros: string[]; pedidoId?: string }> {
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

  const texto = (v?: string | null) => v?.trim() || null;
  const dataPedido = dados.dataPedido && /^\d{4}-\d{2}-\d{2}$/.test(dados.dataPedido) ? new Date(`${dados.dataPedido}T12:00:00-03:00`) : null;
  const cabecalho = {
    numero: dados.semNumero ? null : dados.numero,
    semNumero: dados.semNumero,
    origem: "PDF" as const,
    fabricaId: dados.fabricaId,
    clienteId: dados.clienteId,
    arquivoOrigemId: importacao.arquivoId,
    numeroCliente: texto(dados.numeroCliente),
    dataPedido,
    transportadorPrevisto: texto(dados.transportadorPrevisto),
    modalidadeFrete: texto(dados.modalidadeFrete),
    vendedor: texto(dados.vendedor),
  };
  const itensCriar = dados.itens.map((item) => ({
    referencia: item.referencia,
    descricao: item.descricao,
    quantidadePedida: item.quantidade,
    valorUnitario: item.valorUnitario,
  }));

  if (dados.completarPedidoId) {
    const alvo = await prisma.pedido.findUnique({
      where: { id: dados.completarPedidoId },
      include: { _count: { select: { itens: true, notasFiscais: true } } },
    });
    if (!alvo || alvo.fabricaId !== dados.fabricaId || alvo.clienteId !== dados.clienteId) {
      return { erros: ["O pedido rápido a completar não é desta fábrica e cliente. Recarregue a página."] };
    }
    if (alvo._count.itens > 0 || alvo._count.notasFiscais > 0) {
      return { erros: ["Esse pedido rápido já recebeu itens ou nota. Crie um pedido novo."] };
    }
  }

  let pedidoId = "";
  try {
    await prisma.$transaction(async (tx) => {
      const pedido = dados.completarPedidoId
        ? await tx.pedido.update({
            where: { id: dados.completarPedidoId },
            data: { ...cabecalho, dataPedido: cabecalho.dataPedido ?? undefined, itens: { create: itensCriar } },
            include: { itens: true },
          })
        : await tx.pedido.create({ data: { ...cabecalho, itens: { create: itensCriar } }, include: { itens: true } });
      pedidoId = pedido.id;

      await tx.importacaoPedido.update({
        where: { id: importacao.id },
        data: { estado: "CONFIRMADA", pedidoId: pedido.id, revisaoAtual: dados as unknown as object },
      });

      const eventos = compararCampos(
        "Pedido",
        pedido.id,
        usuario.id,
        {},
        { numero: pedido.numero, semNumero: pedido.semNumero, origem: "PDF", numeroCliente: pedido.numeroCliente, ...(dados.completarPedidoId ? { completouPedidoRapido: "sim" } : {}) },
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
      // Mesmos efeitos de qualquer pedido lançado: vínculo cliente×fábrica e carteira (ADR-013).
      if (!dados.completarPedidoId) await registrarEfeitosDoPedido(tx, pedido);
    });
  } catch (erro) {
    if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002") {
      return { erros: ["Já existe um pedido com este número para este cliente nesta fábrica."] };
    }
    return { erros: ["Nada foi salvo — tente novamente."] };
  }

  revalidatePath("/pedidos");
  return { erros: [], pedidoId };
}

/**
 * O CNPJ do cliente do PDF não está cadastrado: cria a empresa ali mesmo, já ligada à fábrica,
 * para o operador não ter de sair da revisão.
 */
export async function cadastrarClienteDoPdf(dados: { nome: string; cnpj: string; fabricaId: string }): Promise<{ erros: string[]; cliente?: { id: string; nomeFantasia: string } }> {
  const usuario = await obterUsuarioLogado();
  if (!usuario) return { erros: ["Sessão expirada. Faça login novamente."] };
  const nome = dados.nome.trim();
  const cnpj = normalizarCnpj(dados.cnpj);
  if (!nome) return { erros: ["Escreva o nome do cliente."] };
  if (!cnpjValido(cnpj)) return { erros: ["O CNPJ lido do PDF não é válido. Confira no PDF."] };
  if (!dados.fabricaId || !podeAcessarFabrica(usuario, dados.fabricaId)) return { erros: ["Escolha a fábrica primeiro."] };

  const cliente = await prisma.$transaction(async (tx) => {
    const existente = await tx.cliente.findUnique({ where: { cnpj } });
    const c = existente ?? (await tx.cliente.create({ data: { nomeFantasia: nome, cnpj, origem: "Importação de PDF" } }));
    await tx.clienteFabrica.upsert({
      where: { clienteId_fabricaId: { clienteId: c.id, fabricaId: dados.fabricaId } },
      update: {},
      create: { clienteId: c.id, fabricaId: dados.fabricaId },
    });
    if (!existente) {
      await tx.eventoAuditoria.createMany({ data: compararCampos("Cliente", c.id, usuario.id, {}, { nomeFantasia: c.nomeFantasia, cnpj: c.cnpj }) });
    }
    return c;
  });
  revalidatePath("/cadastros/clientes");
  return { erros: [], cliente: { id: cliente.id, nomeFantasia: cliente.nomeFantasia } };
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
