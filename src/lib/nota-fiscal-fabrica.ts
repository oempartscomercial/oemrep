import { prisma } from "./prisma";

export async function obterFabricaIdDaNotaFiscal(notaFiscalId: string): Promise<string | null> {
  const vinculo = await prisma.notaFiscalPedido.findFirst({
    where: { notaFiscalId },
    include: { pedido: true },
  });
  return vinculo?.pedido.fabricaId ?? null;
}
