import type { Prisma } from "@prisma/client";

// Busca de empresas por nome, cidade, site, nome de contato ou CNPJ: a mesma na tela e no Claude.

export const TIPOS_EMPRESA = ["todas", "clientes", "prospeccao"] as const;
export type TipoEmpresa = (typeof TIPOS_EMPRESA)[number];

export function lerTipoEmpresa(valor: string | undefined): TipoEmpresa {
  return TIPOS_EMPRESA.find((t) => t === valor) ?? "todas";
}

export function montarWhereEmpresas(tipo: TipoEmpresa, q: string): Prisma.ClienteWhereInput {
  const where: Prisma.ClienteWhereInput = {};
  if (tipo === "clientes") where.situacao = "CLIENTE";
  if (tipo === "prospeccao") where.situacao = { not: "CLIENTE" };
  const termo = q.trim();
  if (termo) {
    const digitos = termo.replace(/\D/g, "");
    where.OR = [
      { nomeFantasia: { contains: termo, mode: "insensitive" } },
      { cidade: { contains: termo, mode: "insensitive" } },
      { site: { contains: termo, mode: "insensitive" } },
      { contatos: { some: { nome: { contains: termo, mode: "insensitive" } } } },
      ...(digitos.length >= 3 ? [{ cnpj: { contains: digitos } }] : []),
    ];
  }
  return where;
}
