import { prisma } from "@/lib/prisma";
import type { UsuarioSessao } from "@/lib/sessao";
import { filtroFabricasPermitidas } from "@/lib/authz";
import type { PedidoParaGap } from "@/domain/analise/gap";

export async function buscarPedidosParaGap(usuario: UsuarioSessao): Promise<PedidoParaGap[]> {
  const fabricasPermitidas = filtroFabricasPermitidas(usuario);

  const pedidos = await prisma.pedido.findMany({
    where: fabricasPermitidas ? { fabricaId: { in: fabricasPermitidas } } : {},
    include: {
      fabrica: true,
      cliente: true,
      itens: { include: { itensFaturados: true } },
    },
  });

  return pedidos.map((pedido) => ({
    fabrica: pedido.fabrica.nome,
    cliente: pedido.cliente.nomeFantasia,
    criadoEm: pedido.criadoEm,
    itens: pedido.itens.map((item) => ({
      quantidadePedida: item.quantidadePedida,
      valorUnitario: Number(item.valorUnitario),
    })),
    itensFaturados: pedido.itens.flatMap((item) =>
      item.itensFaturados.map((faturado) => ({
        quantidadeFaturada: faturado.quantidadeFaturada,
        valorUnitario: Number(item.valorUnitario),
      })),
    ),
  }));
}
