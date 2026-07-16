import { prisma } from "@/lib/prisma";
import type { UsuarioSessao } from "@/lib/sessao";
import { filtroFabricasPermitidas } from "@/lib/authz";
import { obterParametroNumero } from "@/lib/parametros";
import { buscarPedidosParaAlerta } from "./alertas/queries";
import { pedidosSemNfeVencidos } from "@/domain/alerta/semNfe";
import { buscarChamadosPermitidos } from "./divergencias/queries";

export type ItemFila = {
  tipo: "SEM_NFE" | "CRITICO";
  titulo: string;
  detalhe: string;
  href: string;
  ordem: number; // dias de atraso — maior = mais urgente
};

export type ResumoDashboard = {
  kpis: { pedidosAtivos: number; nfesTransito: number; divergenciasAbertas: number; alertas: number };
  fila: ItemFila[];
};

export async function buscarResumoDashboard(usuario: UsuarioSessao): Promise<ResumoDashboard> {
  const fabricasPermitidas = filtroFabricasPermitidas(usuario);
  const wherePedidoFabrica = fabricasPermitidas ? { fabricaId: { in: fabricasPermitidas } } : {};
  const whereNotaFabrica = fabricasPermitidas
    ? { pedidos: { some: { pedido: { fabricaId: { in: fabricasPermitidas } } } } }
    : {};

  const pedidosAtivos = await prisma.pedido.count({
    where: { ...wherePedidoFabrica, estado: { in: ["SEM_NFE", "PARCIAL"] } },
  });
  const nfesTransito = await prisma.notaFiscal.count({
    where: { status: "TRANSITO", ...whereNotaFabrica },
  });

  const prazoDias = await obterParametroNumero("prazo_alerta_sem_nfe_dias", 7);
  const vencidos = pedidosSemNfeVencidos(await buscarPedidosParaAlerta(usuario), new Date(), prazoDias);

  const chamados = await buscarChamadosPermitidos(usuario);
  const abertos = chamados.filter((c) => c.estado !== "RESOLVIDO");
  const criticos = abertos.filter((c) => c.critico);

  const fila: ItemFila[] = [
    ...vencidos.map((a) => ({
      tipo: "SEM_NFE" as const,
      titulo: `Pedido ${a.numero} sem NFe`,
      detalhe: `${a.fabrica} · ${a.cliente} · ${a.diasSemNfe} dias`,
      href: `/pedidos/${a.pedidoId}`,
      ordem: a.diasSemNfe,
    })),
    ...criticos.map((c) => ({
      tipo: "CRITICO" as const,
      titulo: `Chamado crítico — NFe ${c.notaFiscal.numero}`,
      detalhe: `${c.motivo.nome} · ${c.estado}`,
      href: `/divergencias/${c.id}`,
      ordem: 30, // críticos são urgentes; ficam próximos do topo
    })),
  ].sort((a, b) => b.ordem - a.ordem);

  return {
    kpis: { pedidosAtivos, nfesTransito, divergenciasAbertas: abertos.length, alertas: vencidos.length },
    fila,
  };
}
