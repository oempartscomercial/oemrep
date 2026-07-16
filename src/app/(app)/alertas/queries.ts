import { prisma } from "@/lib/prisma";
import type { UsuarioSessao } from "@/lib/sessao";
import { filtroFabricasPermitidas } from "@/lib/authz";
import type { PedidoParaAlerta } from "@/domain/alerta/semNfe";

export async function buscarPedidosParaAlerta(usuario: UsuarioSessao): Promise<PedidoParaAlerta[]> {
  const fabricasPermitidas = filtroFabricasPermitidas(usuario);

  const pedidos = await prisma.pedido.findMany({
    where: fabricasPermitidas ? { fabricaId: { in: fabricasPermitidas } } : {},
    include: { fabrica: true, cliente: true },
    orderBy: { criadoEm: "desc" },
  });

  return pedidos.map((pedido) => ({
    id: pedido.id,
    numero: pedido.semNumero ? "S/N" : (pedido.numero ?? "—"),
    fabrica: pedido.fabrica.nome,
    cliente: pedido.cliente.nomeFantasia,
    estado: pedido.estado,
    criadoEm: pedido.criadoEm,
  }));
}
