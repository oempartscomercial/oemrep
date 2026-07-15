import { prisma } from "@/lib/prisma";
import type { UsuarioSessao } from "@/lib/sessao";
import { podeAcessarFabrica } from "@/lib/authz";
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

// As demais funções deste arquivo (buscarChamadosPermitidos, buscarChamadoComPermissao)
// são adicionadas na Task 6, quando a lista/detalhe existirem.
