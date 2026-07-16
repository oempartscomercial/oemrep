import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const AUDITORIA_LIMITE = 500;

export type FiltroAuditoria = {
  de?: string; // "AAAA-MM-DD"
  ate?: string; // "AAAA-MM-DD"
  usuarioId?: string;
  entidade?: string;
};

export async function buscarEventosAuditoria(filtro: FiltroAuditoria) {
  const where: Prisma.EventoAuditoriaWhereInput = {};

  if (filtro.usuarioId) where.usuarioId = filtro.usuarioId;
  if (filtro.entidade) where.entidade = filtro.entidade;

  if (filtro.de || filtro.ate) {
    const criadoEm: Prisma.DateTimeFilter = {};
    if (filtro.de) {
      const de = new Date(`${filtro.de}T00:00:00Z`);
      if (!Number.isNaN(de.getTime())) criadoEm.gte = de;
    }
    if (filtro.ate) {
      const ate = new Date(`${filtro.ate}T23:59:59Z`);
      if (!Number.isNaN(ate.getTime())) criadoEm.lte = ate;
    }
    if (criadoEm.gte !== undefined || criadoEm.lte !== undefined) where.criadoEm = criadoEm;
  }

  return prisma.eventoAuditoria.findMany({
    where,
    include: { usuario: true },
    orderBy: { criadoEm: "desc" },
    take: AUDITORIA_LIMITE,
  });
}

export async function listarUsuariosParaFiltro() {
  return prisma.usuario.findMany({ orderBy: { nome: "asc" }, select: { id: true, nome: true } });
}

export async function listarEntidadesAuditadas(): Promise<string[]> {
  const linhas = await prisma.eventoAuditoria.findMany({
    distinct: ["entidade"],
    select: { entidade: true },
    orderBy: { entidade: "asc" },
  });
  return linhas.map((l) => l.entidade);
}
