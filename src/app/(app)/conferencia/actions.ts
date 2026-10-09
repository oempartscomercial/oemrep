"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { atualizarRastreioDaNota } from "@/lib/rastreio/atualizar";
import { prisma } from "@/lib/prisma";
import { obterUsuarioLogado, type UsuarioSessao } from "@/lib/sessao";
import { podeAcessarFabrica } from "@/lib/authz";
import { extrairNFeDoXml, type NFeExtraida } from "@/domain/nfe/parser";
import { aplicarVinculosManuais, type PendenciaItem, type ResultadoConferenciaItem } from "@/domain/nfe/conferencia";
import { resolverClienteDaNFe } from "@/domain/nfe/cliente";
import { validarVinculoPedidos } from "@/domain/nfe/vinculo";
import { aplicarBaixaItem } from "@/domain/nfe/baixa";
import { calcularQtdPendente } from "@/domain/pedido/item";
import { recalcularEstado } from "@/domain/pedido/estado";
import { compararCampos } from "@/domain/auditoria/evento";

export type EmpresaCandidata = { id: string; nome: string; cidade: string | null; uf: string | null };
export type OpcaoVinculo = { itemPedidoId: string; rotulo: string };
// Vínculos escolhidos na tela (RF16): índice do item da NFe → item de pedido (ou null = não baixar).
export type VinculosManuais = Record<number, string | null>;

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
  // Itens pendentes do cliente nesta fábrica: as opções para trocar um vínculo.
  opcoes: OpcaoVinculo[];
  conferencia: ResultadoConferenciaItem[];
  // Números de pedido que a própria nota cita (xPed/infCpl) e qual pedido do sistema bate.
  pedidosCitados: { numero: string; pedido: string | null }[];
  // Pedido rápido (sem itens) deste cliente que a nota parece atender: os itens da nota
  // sem pedido podem completá-lo.
  pedidoRapido: { id: string; numero: string; valor: number; motivo: string } | null;
};

const SEM_SESSAO = "Sessão expirada. Faça login novamente.";
const SEM_PERMISSAO = "Você não tem permissão para conferir notas desta fábrica.";

async function montarAnalise(
  usuario: UsuarioSessao,
  xml: string,
  clienteIdEscolhido: string | null,
  vinculos: VinculosManuais = {},
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

  const base = {
    xml,
    nfe,
    clienteId,
    fabricaId: fabrica?.id ?? null,
    gravarCnpj,
    candidatos: [],
    opcoes: [],
    conferencia: [],
    pedidosCitados: nfe.pedidosReferidos.map((numero) => ({ numero, pedido: null })),
    pedidoRapido: null,
  };
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

  const abertos = await prisma.pedido.findMany({
    where: { clienteId, fabricaId: fabrica.id, estado: { in: ["SEM_NFE", "PARCIAL"] } },
    include: { itens: { where: { status: "PENDENTE" } }, _count: { select: { itens: true } } },
    orderBy: { criadoEm: "asc" },
  });

  // A nota cita o pedido (xPed / "PEDIDO DO CLIENTE" no infCpl): esses vêm primeiro, então
  // uma referência que existe em dois pedidos baixa no pedido que a nota diz atender.
  const citados = new Set(nfe.pedidosReferidos);
  const citaPedido = (p: { numero: string | null; numeroCliente: string | null }) =>
    (!!p.numero && citados.has(p.numero)) || (!!p.numeroCliente && citados.has(p.numeroCliente));
  const pedidos = [...abertos.filter(citaPedido), ...abertos.filter((p) => !citaPedido(p))];
  const pedidosCitados = nfe.pedidosReferidos.map((numero) => {
    const p = abertos.find((x) => x.numero === numero || x.numeroCliente === numero);
    return { numero, pedido: p ? (p.semNumero ? "S/N" : (p.numero ?? "S/N")) : null };
  });

  // Pedido rápido: registrado só com valor, sem itens. Bate pelo número citado ou pelo valor.
  const rapidos = abertos.filter((p) => p.origem === "RAPIDO" && p._count.itens === 0 && p.estado === "SEM_NFE");
  const valorPerto = (p: (typeof rapidos)[number]) => {
    const v = Number(p.valorTotalDeclarado ?? 0);
    if (v <= 0) return false;
    return [nfe.totalProdutos, nfe.totalNota].some((total) => total > 0 && Math.abs(v - total) / total <= 0.02);
  };
  const rapidoCitado = rapidos.find(citaPedido);
  const rapidoPorValor = rapidoCitado ? undefined : rapidos.find(valorPerto);
  const rapidoEscolhido = rapidoCitado ?? rapidoPorValor ?? (rapidos.length === 1 ? rapidos[0] : undefined);
  const pedidoRapido = rapidoEscolhido
    ? {
        id: rapidoEscolhido.id,
        numero: rapidoEscolhido.semNumero ? "S/N" : (rapidoEscolhido.numero ?? "S/N"),
        valor: Number(rapidoEscolhido.valorTotalDeclarado ?? 0),
        motivo: rapidoCitado ? "a nota cita este pedido" : rapidoPorValor ? "o valor bate" : "é o único pedido rápido aberto deste cliente",
      }
    : null;

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

  const resultado = aplicarVinculosManuais(nfe.destinatarioCnpj, nfe.itens, pendencias, vinculos);
  if (resultado.erro) return { erro: resultado.erro };

  const numeroDoPedido = new Map(pedidos.map((p) => [p.id, p.semNumero ? "S/N" : (p.numero ?? "S/N")]));
  const opcoes = pendencias.map((p) => ({
    itemPedidoId: p.itemPedidoId,
    rotulo: `${p.referencia} · pedido ${numeroDoPedido.get(p.pedidoId)} · pendente ${p.quantidadePendente}`,
  }));
  return { analise: { ...base, opcoes, conferencia: resultado.conferencia!, pedidosCitados, pedidoRapido } };
}

export async function analisarXmlNFe(formData: FormData): Promise<{ erro?: string; analise?: AnaliseNFe }> {
  const usuario = await obterUsuarioLogado();
  if (!usuario) return { erro: SEM_SESSAO };

  const arquivo = formData.get("arquivo") as File | null;
  if (!arquivo || arquivo.size === 0) return { erro: "Selecione um arquivo XML." };
  const clienteId = (formData.get("clienteId") as string | null) || null;
  let vinculos: VinculosManuais = {};
  try {
    vinculos = JSON.parse((formData.get("vinculos") as string | null) || "{}");
  } catch {
    return { erro: "Vínculos inválidos." };
  }

  return montarAnalise(usuario, await arquivo.text(), clienteId, vinculos);
}

export async function confirmarBaixaNFe(entrada: {
  xml: string;
  clienteId: string | null;
  vinculos?: VinculosManuais;
  /** Itens da nota sem pedido entram neste pedido rápido (já faturados). */
  completarPedidoRapidoId?: string | null;
}): Promise<{ erros: string[]; notaFiscalId?: string }> {
  const usuario = await obterUsuarioLogado();
  if (!usuario) return { erros: [SEM_SESSAO] };

  const resultado = await montarAnalise(usuario, entrada.xml, entrada.clienteId, entrada.vinculos);
  if ("erro" in resultado) return { erros: [resultado.erro] };
  const { analise } = resultado;
  if (!analise.clienteId || !analise.fabricaId) {
    return { erros: ["Fábrica ou cliente não cadastrado para esta NFe."] };
  }
  const clienteId = analise.clienteId;

  const vinculados = analise.conferencia.filter((r) => r.pendencia !== null);
  const rapidoId = entrada.completarPedidoRapidoId && analise.pedidoRapido?.id === entrada.completarPedidoRapidoId ? entrada.completarPedidoRapidoId : null;
  if (entrada.completarPedidoRapidoId && !rapidoId) return { erros: ["O pedido rápido escolhido não serve para esta nota. Recarregue e confira."] };
  // Sem pendência casada, os itens da nota vêm de analise.nfe.itens (montarAnalise devolve conferencia vazia sem pendências).
  const itensSemPedido = rapidoId
    ? analise.conferencia.length > 0
      ? analise.conferencia.filter((r) => r.pendencia === null).map((r) => r.itemNFe)
      : analise.nfe.itens
    : [];
  if (vinculados.length === 0 && itensSemPedido.length === 0) {
    return { erros: ["Nenhum item da NFe corresponde a um pedido pendente."] };
  }

  const pedidosIds = [...new Set([...vinculados.map((r) => r.pendencia!.pedidoId), ...(rapidoId ? [rapidoId] : [])])];
  const erros = validarVinculoPedidos(pedidosIds.map((id) => ({ id, clienteId })));
  if (erros.length > 0) return { erros };

  let notaFiscalId = "";
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

      // Transportadora do <transp>: nasce sozinha na primeira nota, como não mapeada.
      const transp = analise.nfe.transportadora;
      const transportadora = transp?.cnpj
        ? await tx.transportadora.upsert({
            where: { cnpj: transp.cnpj },
            update: {},
            create: { cnpj: transp.cnpj, nome: transp.nome || `Transportadora ${transp.cnpj}` },
          })
        : null;

      const notaFiscal = await tx.notaFiscal.create({
        data: {
          transportadoraId: transportadora?.id ?? null,
          modalidadeFrete: analise.nfe.modalidadeFrete,
          volumes: analise.nfe.volumes === null ? null : Math.round(analise.nfe.volumes),
          pesoBruto: analise.nfe.pesoBruto,
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
          data: {
            itemPedidoId: item.id,
            notaFiscalId: notaFiscal.id,
            quantidadeFaturada: resultadoItem.itemNFe.quantidade,
            // O preço REALMENTE faturado, vindo da NFe — não o do pedido. É o que permite
            // o painel de gap enxergar sobrefaturamento em vez de mostrar sempre R$ 0.
            valorUnitario: resultadoItem.itemNFe.valorUnitario,
          },
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

      // Pedido rápido completado pela nota: os itens nascem já faturados por ela.
      if (rapidoId) {
        for (const itemNFe of itensSemPedido) {
          const criado = await tx.itemPedido.create({
            data: {
              pedidoId: rapidoId,
              referencia: itemNFe.referencia,
              descricao: itemNFe.descricao,
              quantidadePedida: itemNFe.quantidade,
              quantidadeFaturada: itemNFe.quantidade,
              valorUnitario: itemNFe.valorUnitario,
              status: "OK",
              observacao: "Item criado a partir da NFe (pedido rápido).",
            },
          });
          await tx.itemFaturado.create({
            data: { itemPedidoId: criado.id, notaFiscalId: notaFiscal.id, quantidadeFaturada: itemNFe.quantidade, valorUnitario: itemNFe.valorUnitario },
          });
        }
        await tx.eventoAuditoria.createMany({
          data: compararCampos("Pedido", rapidoId, usuario.id, {}, { itensDaNota: `${itensSemPedido.length} itens da NF ${analise.nfe.numero}` }),
        });
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
      notaFiscalId = notaFiscal.id;
    });
  } catch {
    return { erros: ["Falha ao gravar a baixa da NFe. Nada foi salvo — tente novamente."] };
  }

  for (const pedidoId of pedidosIds) revalidatePath(`/pedidos/${pedidoId}`);
  revalidatePath("/pedidos");
  revalidatePath("/rastreio");
  // Primeira consulta de rastreio já, sem segurar a tela: roda depois da resposta.
  try {
    after(async () => {
      try {
        await atualizarRastreioDaNota(notaFiscalId);
      } catch (erro) {
        console.error("[rastreio] primeira consulta falhou", erro);
      }
    });
  } catch {
    // Fora de uma requisição (testes): o cron diário faz a consulta.
  }
  return { erros: [], notaFiscalId };
}
