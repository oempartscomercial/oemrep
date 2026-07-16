import { prisma } from "./prisma";

export async function obterParametroNumero(chave: string, padrao: number): Promise<number> {
  const parametro = await prisma.parametro.findUnique({ where: { chave } });
  if (!parametro) return padrao;

  const valor = Number(parametro.valor);
  return Number.isFinite(valor) ? valor : padrao;
}
