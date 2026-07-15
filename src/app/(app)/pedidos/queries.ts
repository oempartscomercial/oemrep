import { prisma } from "@/lib/prisma";
import type { UsuarioSessao } from "@/lib/sessao";
import { filtroFabricasPermitidas, podeAcessarFabrica } from "@/lib/authz";

const INCLUDE_PEDIDO = { fabrica: true, cliente: true, itens: true } as const;

export async function buscarPedidosPermitidos(usuario: UsuarioSessao) {
  const fabricasPermitidas = filtroFabricasPermitidas(usuario);
  return prisma.pedido.findMany({
    where: fabricasPermitidas ? { fabricaId: { in: fabricasPermitidas } } : {},
    include: INCLUDE_PEDIDO,
    orderBy: { criadoEm: "desc" },
  });
}

export async function buscarPedidoComPermissao(id: string, usuario: UsuarioSessao) {
  const pedido = await prisma.pedido.findUnique({ where: { id }, include: INCLUDE_PEDIDO });
  if (!pedido) return null;
  if (!podeAcessarFabrica(usuario, pedido.fabricaId)) return null;
  return pedido;
}
