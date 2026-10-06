import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { UsuarioSessao } from "@/lib/sessao";
import { filtroFabricasPermitidas } from "@/lib/authz";
import { intervaloDoMes, type FiltroItens } from "@/domain/pedido/filtro-itens";
import { calcularQtdPendente } from "@/domain/pedido/item";

export const ITENS_POR_PAGINA = 100;

export function montarWhereItens(usuario: UsuarioSessao, filtro: Omit<FiltroItens, "pagina">): Prisma.ItemPedidoWhereInput {
  const permitidas = filtroFabricasPermitidas(usuario);
  const pedido: Prisma.PedidoWhereInput = {};
  // A fábrica do filtro só vale se estiver entre as permitidas (ADR-009).
  if (filtro.fabricaId) {
    pedido.fabricaId = permitidas && !permitidas.includes(filtro.fabricaId) ? { in: [] } : filtro.fabricaId;
  } else if (permitidas) {
    pedido.fabricaId = { in: permitidas };
  }
  if (filtro.clienteId) pedido.clienteId = filtro.clienteId;
  if (filtro.mes) pedido.criadoEm = intervaloDoMes(filtro.mes);

  return {
    pedido,
    ...(filtro.status !== "TODOS" ? { status: filtro.status } : {}),
    ...(filtro.referencia ? { referencia: { contains: filtro.referencia, mode: "insensitive" as const } } : {}),
  };
}

export async function buscarItens(usuario: UsuarioSessao, filtro: FiltroItens, porPagina = ITENS_POR_PAGINA) {
  const where = montarWhereItens(usuario, filtro);
  const [total, itens] = await Promise.all([
    prisma.itemPedido.count({ where }),
    prisma.itemPedido.findMany({
      where,
      include: { pedido: { include: { fabrica: true, cliente: true } } },
      orderBy: [{ pedido: { criadoEm: "desc" } }, { referencia: "asc" }],
      skip: (filtro.pagina - 1) * porPagina,
      take: porPagina,
    }),
  ]);

  return {
    total,
    itens: itens.map((item) => ({
      id: item.id,
      pedidoId: item.pedidoId,
      pedidoNumero: item.pedido.semNumero ? "S/N" : (item.pedido.numero ?? "S/N"),
      dataPedido: item.pedido.criadoEm,
      fabrica: item.pedido.fabrica.nome,
      cliente: item.pedido.cliente.nomeFantasia,
      referencia: item.referencia,
      descricao: item.descricao,
      quantidadePedida: item.quantidadePedida,
      quantidadeFaturada: item.quantidadeFaturada,
      quantidadePendente: calcularQtdPendente(item),
      valorUnitario: Number(item.valorUnitario),
      status: item.status,
    })),
  };
}
