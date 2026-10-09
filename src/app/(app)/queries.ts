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
  calcularTotaisMensaisAoVivo,
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

export async function buscarSerieMensal(usuario: UsuarioSessao): Promise<PontoMensal[]> {
  const fabricasPermitidas = filtroFabricasPermitidas(usuario);
  const wherePedidoFabrica = fabricasPermitidas ? { fabricaId: { in: fabricasPermitidas } } : {};
  const whereNotaFabrica = fabricasPermitidas
    ? { pedidos: { some: { pedido: { fabricaId: { in: fabricasPermitidas } } } } }
    : {};
  const whereHistoricoFabrica = fabricasPermitidas ? { fabricaId: { in: fabricasPermitidas } } : {};

  const [historicoRaw, pedidos, notas] = await Promise.all([
    prisma.historicoMensal.findMany({ where: whereHistoricoFabrica }),
    prisma.pedido.findMany({
      where: wherePedidoFabrica,
      include: { itens: true },
    }),
    prisma.notaFiscal.findMany({ where: whereNotaFabrica }),
  ]);

  const historico: HistoricoMensalRow[] = historicoRaw.map((h) => ({
    ano: h.ano,
    mes: h.mes,
    tipo: h.tipo,
    valor: Number(h.valor),
  }));

  const aoVivo = calcularTotaisMensaisAoVivo(
    pedidos.map((p) => ({
      // O mês do pedido é o da data informada; um pedido rápido (sem itens) vale o total declarado.
      criadoEm: p.dataPedido ?? p.criadoEm,
      itens:
        p.itens.length > 0
          ? p.itens.map((i) => ({ quantidadePedida: i.quantidadePedida, valorUnitario: Number(i.valorUnitario) }))
          : [{ quantidadePedida: 1, valorUnitario: Number(p.valorTotalDeclarado ?? 0) }],
    })),
    notas.map((n) => ({ dataEmissao: n.dataEmissao, totalNota: Number(n.totalNota) })),
  );

  return combinarSeries(historico, aoVivo);
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
