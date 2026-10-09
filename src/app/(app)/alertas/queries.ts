import { prisma } from "@/lib/prisma";
import type { UsuarioSessao } from "@/lib/sessao";
import { filtroFabricasPermitidas } from "@/lib/authz";
import { obterParametroNumero } from "@/lib/parametros";
import type { PedidoParaAlerta } from "@/domain/alerta/semNfe";
import { montarAlertas, type Alerta, type NotaParaAlerta } from "@/domain/alerta/fila";
import { saldoAFaturar } from "@/domain/pedido/valor";
import { emTransito } from "@/domain/rastreio/parada";
import { buscarNotasFiscaisPermitidas } from "../rastreio/queries";
import { buscarChamadosPermitidos } from "../divergencias/queries";

export async function buscarPedidosParaAlerta(usuario: UsuarioSessao): Promise<PedidoParaAlerta[]> {
  const fabricasPermitidas = filtroFabricasPermitidas(usuario);

  const pedidos = await prisma.pedido.findMany({
    where: fabricasPermitidas ? { fabricaId: { in: fabricasPermitidas } } : {},
    include: { fabrica: true, cliente: true, itens: true },
    orderBy: { criadoEm: "desc" },
  });

  return pedidos.map((pedido) => ({
    id: pedido.id,
    numero: pedido.semNumero ? "S/N" : (pedido.numero ?? "—"),
    fabrica: pedido.fabrica.nome,
    cliente: pedido.cliente.nomeFantasia,
    estado: pedido.estado,
    criadoEm: pedido.criadoEm,
    dataPedido: pedido.dataPedido,
    prazoDias: pedido.fabrica.slaDiasSemNota,
    saldo: saldoAFaturar({
      estado: pedido.estado,
      valorTotalDeclarado: pedido.valorTotalDeclarado,
      itens: pedido.itens.map((i) => ({ ...i, valorUnitario: Number(i.valorUnitario) })),
    }),
    rapidoSemItens: pedido.origem === "RAPIDO" && pedido.itens.length === 0,
  }));
}

export async function buscarPrazoPadraoSemNota(): Promise<number> {
  return obterParametroNumero("prazo_alerta_sem_nfe_dias", 7);
}

/** Todos os alertas que o usuário pode ver, já ordenados por urgência. */
export async function buscarAlertas(usuario: UsuarioSessao): Promise<{ alertas: Alerta[]; prazoPadraoDias: number }> {
  const [prazoPadraoDias, pedidos, notas, chamados] = await Promise.all([
    buscarPrazoPadraoSemNota(),
    buscarPedidosParaAlerta(usuario),
    buscarNotasFiscaisPermitidas(usuario),
    buscarChamadosPermitidos(usuario),
  ]);

  const notasEmTransito: NotaParaAlerta[] = notas
    .filter((n) => emTransito(n.status))
    .map((n) => ({
      id: n.id,
      numero: n.numero,
      cliente: [...new Set(n.pedidos.map((p) => p.pedido.cliente.nomeFantasia))].join(", ") || "—",
      status: n.status,
      dataEmissao: n.dataEmissao,
      totalNota: Number(n.totalNota),
      ultimaOcorrencia: n.ultimaOcorrencia,
      ultimaOcorrenciaEm: n.ultimaOcorrenciaEm,
      transportadora: n.transportadora ? { nome: n.transportadora.nome, metodo: n.transportadora.metodo } : null,
    }));

  const chamadosCriticos = chamados
    .filter((c) => c.critico && c.estado !== "RESOLVIDO")
    .map((c) => ({ id: c.id, numeroNota: c.notaFiscal.numero, motivo: c.motivo.nome, estado: c.estado, criadoEm: c.criadoEm }));

  return {
    alertas: montarAlertas({ pedidos, notas: notasEmTransito, chamadosCriticos, prazoPadraoDias }),
    prazoPadraoDias,
  };
}
