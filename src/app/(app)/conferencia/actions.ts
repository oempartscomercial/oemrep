"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { obterUsuarioLogado, type UsuarioSessao } from "@/lib/sessao";
import { podeAcessarFabrica } from "@/lib/authz";
import { extrairNFeDoXml, type NFeExtraida } from "@/domain/nfe/parser";
import { conferirItens, type PendenciaItem, type ResultadoConferenciaItem } from "@/domain/nfe/conferencia";
import { resolverClienteDaNFe } from "@/domain/nfe/cliente";
import { validarVinculoPedidos } from "@/domain/nfe/vinculo";
import { aplicarBaixaItem } from "@/domain/nfe/baixa";
import { calcularQtdPendente } from "@/domain/pedido/item";
import { recalcularEstado } from "@/domain/pedido/estado";
import { compararCampos } from "@/domain/auditoria/evento";

export type EmpresaCandidata = { id: string; nome: string; cidade: string | null; uf: string | null };

export type AnaliseNFe = {
  // O XML volta para o servidor na confirmação: tudo é recalculado a partir dele,
  // nada do que a tela mostra é confiado (quantidades, vínculos, ids).
  xml: string;
  nfe: NFeExtraida;
  clienteId: string | null;
  fabricaId: string | null;
  // Empresa escolhida ainda sem CNPJ: a confirmação grava o CNPJ da nota nela (ADR-013).
  gravarCnpj: boolean;
  // Sem empresa com o CNPJ da nota: empresas sem CNPJ com pedido aberto nesta fábrica.
  candidatos: EmpresaCandidata[];
  conferencia: ResultadoConferenciaItem[];
};

const SEM_SESSAO = "Sessão expirada. Faça login novamente.";
const SEM_PERMISSAO = "Você não tem permissão para conferir notas desta fábrica.";

async function montarAnalise(
  usuario: UsuarioSessao,
  xml: string,
  clienteIdEscolhido: string | null,
): Promise<{ erro: string } | { analise: AnaliseNFe }> {
  let nfe: NFeExtraida;
  try {
    nfe = extrairNFeDoXml(xml);
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : "Falha ao ler o XML." };
  }

  const existente = await prisma.notaFiscal.findUnique({ where: { chaveAcesso: nfe.chaveAcesso } });
  if (existente) return { erro: "Esta NFe já foi importada." };

  const [clientePorCnpj, fabrica, clienteEscolhido] = await Promise.all([
    prisma.cliente.findUnique({ where: { cnpj: nfe.destinatarioCnpj } }),
    prisma.fabrica.findUnique({ where: { cnpj: nfe.emitenteCnpj } }),
    clienteIdEscolhido ? prisma.cliente.findUnique({ where: { id: clienteIdEscolhido } }) : null,
  ]);
  if (fabrica && !podeAcessarFabrica(usuario, fabrica.id)) return { erro: SEM_PERMISSAO };
  if (clienteIdEscolhido && !clienteEscolhido) return { erro: "Empresa escolhida não encontrada." };

  const resolucao = resolverClienteDaNFe(nfe.destinatarioCnpj, clientePorCnpj, clienteEscolhido);
  if ("erro" in resolucao) return { erro: resolucao.erro };
  const { clienteId, gravarCnpj } = resolucao;

  const base = { xml, nfe, clienteId, fabricaId: fabrica?.id ?? null, gravarCnpj, candidatos: [], conferencia: [] };
  if (!fabrica) return { analise: base };

  if (!clienteId) {
    const candidatos = await prisma.cliente.findMany({
      where: { cnpj: null, pedidos: { some: { fabricaId: fabrica.id, estado: { in: ["SEM_NFE", "PARCIAL"] } } } },
      select: { id: true, nomeFantasia: true, cidade: true, uf: true },
      orderBy: { nomeFantasia: "asc" },
    });
    return {
      analise: { ...base, candidatos: candidatos.map((c) => ({ id: c.id, nome: c.nomeFantasia, cidade: c.cidade, uf: c.uf })) },
    };
  }

  const pedidos = await prisma.pedido.findMany({
    where: { clienteId, fabricaId: fabrica.id, estado: { in: ["SEM_NFE", "PARCIAL"] } },
    include: { itens: { where: { status: "PENDENTE" } } },
  });

  const pendencias: PendenciaItem[] = pedidos.flatMap((pedido) =>
    pedido.itens.map((item) => ({
      itemPedidoId: item.id,
      pedidoId: pedido.id,
      clienteCnpj: nfe.destinatarioCnpj,
      referencia: item.referencia,
      quantidadePendente: calcularQtdPendente({
        quantidadePedida: item.quantidadePedida,
        quantidadeFaturada: item.quantidadeFaturada,
      }),
      valorUnitario: Number(item.valorUnitario),
    })),
  );

  return { analise: { ...base, conferencia: conferirItens(nfe.destinatarioCnpj, nfe.itens, pendencias) } };
}

export async function analisarXmlNFe(formData: FormData): Promise<{ erro?: string; analise?: AnaliseNFe }> {
  const usuario = await obterUsuarioLogado();
  if (!usuario) return { erro: SEM_SESSAO };

  const arquivo = formData.get("arquivo") as File | null;
  if (!arquivo || arquivo.size === 0) return { erro: "Selecione um arquivo XML." };
  const clienteId = (formData.get("clienteId") as string | null) || null;

  return montarAnalise(usuario, await arquivo.text(), clienteId);
}

export async function confirmarBaixaNFe(entrada: { xml: string; clienteId: string | null }): Promise<{ erros: string[] }> {
  const usuario = await obterUsuarioLogado();
  if (!usuario) return { erros: [SEM_SESSAO] };

  const resultado = await montarAnalise(usuario, entrada.xml, entrada.clienteId);
  if ("erro" in resultado) return { erros: [resultado.erro] };
  const { analise } = resultado;
  if (!analise.clienteId || !analise.fabricaId) {
    return { erros: ["Fábrica ou cliente não cadastrado para esta NFe."] };
  }
  const clienteId = analise.clienteId;

  const vinculados = analise.conferencia.filter((r) => r.pendencia !== null);
  if (vinculados.length === 0) return { erros: ["Nenhum item da NFe corresponde a um pedido pendente."] };

  const pedidosIds = [...new Set(vinculados.map((r) => r.pendencia!.pedidoId))];
  const erros = validarVinculoPedidos(pedidosIds.map((id) => ({ id, clienteId })));
  if (erros.length > 0) return { erros };

  // Nota fiscal, CNPJ do cliente, baixa de itens, recálculo de estado do pedido e
  // auditoria formam uma única unidade de trabalho: uma falha no meio não pode deixar
  // uma baixa parcial gravada sem o pedido saber (regra 4 do CLAUDE.md).
  try {
    await prisma.$transaction(async (tx) => {
      if (analise.gravarCnpj) {
        await tx.cliente.update({ where: { id: clienteId }, data: { cnpj: analise.nfe.destinatarioCnpj } });
        await tx.eventoAuditoria.createMany({
          data: compararCampos("Cliente", clienteId, usuario.id, { cnpj: null }, { cnpj: analise.nfe.destinatarioCnpj }),
        });
      }

      const notaFiscal = await tx.notaFiscal.create({
        data: {
          numero: analise.nfe.numero,
          chaveAcesso: analise.nfe.chaveAcesso,
          emitenteCnpj: analise.nfe.emitenteCnpj,
          destinatarioCnpj: analise.nfe.destinatarioCnpj,
          dataEmissao: new Date(analise.nfe.dataEmissao),
          totalProdutos: analise.nfe.totalProdutos,
          totalNota: analise.nfe.totalNota,
          pedidos: { create: pedidosIds.map((pedidoId) => ({ pedidoId })) },
        },
      });

      for (const resultadoItem of vinculados) {
        const pendencia = resultadoItem.pendencia!;
        const item = await tx.itemPedido.findUnique({ where: { id: pendencia.itemPedidoId } });
        if (!item) continue;

        const { quantidadeFaturada, status } = aplicarBaixaItem(item, resultadoItem.itemNFe.quantidade);

        await tx.itemFaturado.create({
          data: { itemPedidoId: item.id, notaFiscalId: notaFiscal.id, quantidadeFaturada: resultadoItem.itemNFe.quantidade },
        });
        await tx.itemPedido.update({ where: { id: item.id }, data: { quantidadeFaturada, status } });
        const eventosItem = compararCampos(
          "ItemPedido",
          item.id,
          usuario.id,
          { quantidadeFaturada: item.quantidadeFaturada, status: item.status },
          { quantidadeFaturada, status },
        );
        if (eventosItem.length > 0) await tx.eventoAuditoria.createMany({ data: eventosItem });
      }

      for (const pedidoId of pedidosIds) {
        const pedido = await tx.pedido.findUnique({ where: { id: pedidoId }, include: { itens: true } });
        if (!pedido) continue;

        // ADR-008: o pedido só sai de SEM_NFE quando a 1ª NFe é vinculada. A partir
        // daí, recalcularEstado decide entre PARCIAL/COMPLETO olhando só os itens
        // (ADR-005).
        const baseParaRecalculo = pedido.estado === "SEM_NFE" ? "PARCIAL" : pedido.estado;
        const novoEstado = recalcularEstado(baseParaRecalculo, pedido.itens);

        if (novoEstado !== pedido.estado) {
          await tx.pedido.update({ where: { id: pedidoId }, data: { estado: novoEstado } });
          const eventosPedido = compararCampos(
            "Pedido",
            pedidoId,
            usuario.id,
            { estado: pedido.estado },
            { estado: novoEstado },
          );
          if (eventosPedido.length > 0) await tx.eventoAuditoria.createMany({ data: eventosPedido });
        }
      }

      const eventosNota = compararCampos(
        "NotaFiscal",
        notaFiscal.id,
        usuario.id,
        {},
        { chaveAcesso: notaFiscal.chaveAcesso, numero: notaFiscal.numero },
      );
      if (eventosNota.length > 0) await tx.eventoAuditoria.createMany({ data: eventosNota });
    });
  } catch {
    return { erros: ["Falha ao gravar a baixa da NFe. Nada foi salvo — tente novamente."] };
  }

  for (const pedidoId of pedidosIds) revalidatePath(`/pedidos/${pedidoId}`);
  revalidatePath("/pedidos");
  return { erros: [] };
}
