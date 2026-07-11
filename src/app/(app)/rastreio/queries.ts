import { prisma } from "@/lib/prisma";
import type { UsuarioSessao } from "@/lib/sessao";
import { filtroFabricasPermitidas, podeAcessarFabrica } from "@/lib/authz";
import { obterFabricaIdDaNotaFiscal } from "@/lib/nota-fiscal-fabrica";

export async function buscarNotasFiscaisPermitidas(usuario: UsuarioSessao) {
  const fabricasPermitidas = filtroFabricasPermitidas(usuario);
  return prisma.notaFiscal.findMany({
    where: fabricasPermitidas
      ? { pedidos: { some: { pedido: { fabricaId: { in: fabricasPermitidas } } } } }
      : {},
    orderBy: { criadoEm: "desc" },
  });
}

export async function buscarNotaFiscalComPermissao(id: string, usuario: UsuarioSessao) {
  const nota = await prisma.notaFiscal.findUnique({ where: { id } });
  if (!nota) return null;

  const fabricaId = await obterFabricaIdDaNotaFiscal(id);
  if (!fabricaId || !podeAcessarFabrica(usuario, fabricaId)) return null;

  return nota;
}
