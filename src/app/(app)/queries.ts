import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { UsuarioSessao } from "@/lib/sessao";
import { filtroFabricasPermitidas, podeVerCrm } from "@/lib/authz";
import { hojeEmSaoPaulo } from "@/domain/crm/prazo";
import { buscarAlertas } from "./alertas/queries";
import { contarAlertas, type Alerta } from "@/domain/alerta/fila";
import { buscarChamadosPermitidos } from "./divergencias/queries";
import { saldoAFaturar, valorDoPedido } from "@/domain/pedido/valor";
import { resumirPorFabrica, type ResumoFabrica } from "@/domain/analise/painel";
import { emTransito } from "@/domain/rastreio/parada";
import {
  combinarSeries,
  type HistoricoMensalRow,
  type PontoMensal,
} from "@/domain/analise/totaisMensais";

export type ResumoDashboard = {
  kpis: {
    pedidosAtivos: number;
    semNota: { quantidade: number; valor: number };
    nfesTransito: number;
    notasSemNoticia: number;
    divergenciasAbertas: number;
    alertas: number;
  };
  fabricas: ResumoFabrica[];
  fila: Alerta[];
};

export async function buscarResumoDashboard(usuario: UsuarioSessao, agora: Date = new Date()): Promise<ResumoDashboard> {
  const fabricasPermitidas = filtroFabricasPermitidas(usuario);
  const wherePedidoFabrica = fabricasPermitidas ? { fabricaId: { in: fabricasPermitidas } } : {};
  const whereNotaFabrica = fabricasPermitidas
    ? { pedidos: { some: { pedido: { fabricaId: { in: fabricasPermitidas } } } } }
    : {};
  // Folga de um dia antes do mês para não perder nota emitida na virada (fuso de São Paulo).
  const inicioMes = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), 1) - 24 * 60 * 60 * 1000);

  const [fabricas, pedidos, notasMes, notasTransito, chamados, { alertas }] = await Promise.all([
    prisma.fabrica.findMany({
      where: { ativo: true, ...(fabricasPermitidas ? { id: { in: fabricasPermitidas } } : {}) },
      select: { id: true, nome: true },
    }),
    prisma.pedido.findMany({
      where: wherePedidoFabrica,
      select: {
        fabricaId: true,
        estado: true,
        dataPedido: true,
        criadoEm: true,
        valorTotalDeclarado: true,
        itens: { select: { quantidadePedida: true, quantidadeFaturada: true, valorUnitario: true, status: true } },
      },
    }),
    prisma.notaFiscal.findMany({
      where: { ...whereNotaFabrica, dataEmissao: { gte: inicioMes } },
      select: { dataEmissao: true, totalNota: true, pedidos: { select: { pedido: { select: { fabricaId: true } } }, take: 1 } },
    }),
    prisma.notaFiscal.findMany({ where: whereNotaFabrica, select: { status: true } }),
    buscarChamadosPermitidos(usuario),
    buscarAlertas(usuario),
  ]);

  const pedidosPainel = pedidos.map((p) => {
    const valores = {
      estado: p.estado,
      valorTotalDeclarado: p.valorTotalDeclarado,
      itens: p.itens.map((i) => ({ ...i, valorUnitario: Number(i.valorUnitario) })),
    };
    return { fabricaId: p.fabricaId, estado: p.estado, dataRef: p.dataPedido ?? p.criadoEm, valor: valorDoPedido(valores), saldo: saldoAFaturar(valores) };
  });
  const semNota = pedidosPainel.filter((p) => p.estado === "SEM_NFE");
  const contagem = contarAlertas(alertas);

  return {
    kpis: {
      pedidosAtivos: pedidos.filter((p) => p.estado === "SEM_NFE" || p.estado === "PARCIAL").length,
      semNota: { quantidade: semNota.length, valor: Math.round(semNota.reduce((s, p) => s + p.saldo, 0) * 100) / 100 },
      nfesTransito: notasTransito.filter((n) => emTransito(n.status)).length,
      notasSemNoticia: contagem.NOTA_PARADA + contagem.SEM_RASTREIO,
      divergenciasAbertas: chamados.filter((c) => c.estado !== "RESOLVIDO").length,
      alertas: alertas.length,
    },
    fabricas: resumirPorFabrica(
      fabricas,
      pedidosPainel,
      notasMes.map((n) => ({ fabricaId: n.pedidos[0]?.pedido.fabricaId ?? null, dataEmissao: n.dataEmissao, totalNota: Number(n.totalNota) })),
      agora,
    ),
    fila: alertas,
  };
}

/**
 * Série mensal de pedidos recebidos × NFe. O banco já devolve a soma por mês (antes vinham
 * todos os pedidos com todos os itens e todas as notas para somar aqui, a cada visita ao Início).
 */
export async function buscarSerieMensal(usuario: UsuarioSessao): Promise<PontoMensal[]> {
  const fabricasPermitidas = filtroFabricasPermitidas(usuario);
  const whereHistoricoFabrica = fabricasPermitidas ? { fabricaId: { in: fabricasPermitidas } } : {};
  const ids = fabricasPermitidas && fabricasPermitidas.length > 0 ? fabricasPermitidas : [""];
  const filtroPedido = fabricasPermitidas ? Prisma.sql`WHERE p."fabricaId" IN (${Prisma.join(ids)})` : Prisma.empty;
  const filtroNota = fabricasPermitidas
    ? Prisma.sql`WHERE EXISTS (SELECT 1 FROM "NotaFiscalPedido" np JOIN "Pedido" p ON p."id" = np."pedidoId" WHERE np."notaFiscalId" = n."id" AND p."fabricaId" IN (${Prisma.join(ids)}))`
    : Prisma.empty;

  const [historicoRaw, pedidos, notas] = await Promise.all([
    prisma.historicoMensal.findMany({ where: whereHistoricoFabrica, select: { ano: true, mes: true, tipo: true, valor: true } }),
    // O mês do pedido é o da data informada; um pedido rápido (sem itens) vale o total declarado.
    prisma.$queryRaw<{ mes: string; valor: number }[]>`
      SELECT to_char(COALESCE(p."dataPedido", p."criadoEm"), 'YYYY-MM') AS mes,
             SUM(COALESCE(i.total, p."valorTotalDeclarado", 0))::float8 AS valor
      FROM "Pedido" p
      LEFT JOIN (SELECT "pedidoId", SUM("quantidadePedida" * "valorUnitario") AS total FROM "ItemPedido" GROUP BY "pedidoId") i ON i."pedidoId" = p."id"
      ${filtroPedido}
      GROUP BY 1`,
    prisma.$queryRaw<{ mes: string; valor: number }[]>`
      SELECT to_char(n."dataEmissao", 'YYYY-MM') AS mes, SUM(n."totalNota")::float8 AS valor
      FROM "NotaFiscal" n
      ${filtroNota}
      GROUP BY 1`,
  ]);

  const historico: HistoricoMensalRow[] = historicoRaw.map((h) => ({ ano: h.ano, mes: h.mes, tipo: h.tipo, valor: Number(h.valor) }));
  const aoVivo = new Map<string, PontoMensal>();
  const ponto = (mes: string) => aoVivo.get(mes) ?? aoVivo.set(mes, { mes, valorPedido: 0, valorNfe: 0 }).get(mes)!;
  for (const p of pedidos) ponto(p.mes).valorPedido += Number(p.valor);
  for (const n of notas) ponto(n.mes).valorNfe += Number(n.valor);

  return combinarSeries(historico, [...aoVivo.values()]);
}

export type TarefasCrm = {
  passos: { id: string; empresaId: string; empresa: string; acao: string; prazo: string }[];
  candidatas: number;
};

/** Próximos passos do usuário que vencem hoje ou já venceram, e empresas esperando avaliação. */
export async function buscarTarefasCrm(usuario: UsuarioSessao): Promise<TarefasCrm | null> {
  if (!podeVerCrm(usuario)) return null;
  const hoje = hojeEmSaoPaulo();
  const [passos, candidatas] = await Promise.all([
    prisma.proximoPasso.findMany({
      where: { responsavelId: usuario.id, concluidoEm: null, prazo: { lte: new Date(`${hoje}T00:00:00Z`) } },
      orderBy: { prazo: "asc" },
      take: 10,
      include: { cliente: true, oportunidade: { include: { fabrica: true } } },
    }),
    prisma.cliente.count({ where: { situacao: "CANDIDATA" } }),
  ]);
  return {
    candidatas,
    passos: passos.map((p) => ({
      id: p.id,
      empresaId: p.clienteId,
      empresa: p.oportunidade ? `${p.cliente.nomeFantasia} · ${p.oportunidade.fabrica.nome}` : p.cliente.nomeFantasia,
      acao: p.acao,
      prazo: p.prazo.toISOString().slice(0, 10),
    })),
  };
}
