import { prisma } from "@/lib/prisma";
import type { UsuarioSessao } from "@/lib/sessao";
import { filtroFabricasPermitidas, podeAcessarFabrica } from "@/lib/authz";
import { obterFabricaIdDaNotaFiscal } from "@/lib/nota-fiscal-fabrica";

export async function buscarContextoAberturaChamado(notaFiscalId: string, usuario: UsuarioSessao) {
  const notaFiscal = await prisma.notaFiscal.findUnique({
    where: { id: notaFiscalId },
    include: { itensFaturados: { include: { itemPedido: { include: { pedido: true } } } } },
  });
  if (!notaFiscal) return null;

  const fabricaId = await obterFabricaIdDaNotaFiscal(notaFiscalId);
  if (!fabricaId || !podeAcessarFabrica(usuario, fabricaId)) return null;

  const motivos = await prisma.motivoChamado.findMany({ orderBy: { nome: "asc" } });

  return { notaFiscal, motivos };
}

export async function buscarChamadosPermitidos(usuario: UsuarioSessao) {
  const fabricasPermitidas = filtroFabricasPermitidas(usuario);
  return prisma.chamado.findMany({
    where: fabricasPermitidas
      ? { notaFiscal: { pedidos: { some: { pedido: { fabricaId: { in: fabricasPermitidas } } } } } }
      : {},
    include: {
      notaFiscal: true,
      motivo: true,
      eventos: { orderBy: { criadoEm: "desc" }, take: 1 },
    },
    orderBy: { criadoEm: "desc" },
  });
}

export async function buscarChamadoComPermissao(id: string, usuario: UsuarioSessao) {
  const chamado = await prisma.chamado.findUnique({
    where: { id },
    include: {
      notaFiscal: true,
      motivo: true,
      itensAfetados: { include: { itemPedido: true } },
      eventos: { orderBy: { criadoEm: "desc" }, include: { usuario: true } },
    },
  });
  if (!chamado) return null;

  const fabricaId = await obterFabricaIdDaNotaFiscal(chamado.notaFiscalId);
  if (!fabricaId || !podeAcessarFabrica(usuario, fabricaId)) return null;

  return chamado;
}
