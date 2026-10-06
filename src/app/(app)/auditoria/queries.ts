import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { NomesAuditoria } from "@/domain/auditoria/descricao";

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

type EventoComIds = { entidade: string; entidadeId: string; campo: string; valorAnterior: string | null; valorNovo: string | null };

function numeroPedido(p: { numero: string | null; semNumero: boolean }) {
  return p.semNumero ? "S/N" : (p.numero ?? "S/N");
}

// Nomes legíveis dos registros e dos ids que aparecem como valor (descreverEvento).
export async function carregarNomesAuditoria(eventos: EventoComIds[]): Promise<NomesAuditoria> {
  const ids = (entidade: string) => [...new Set(eventos.filter((e) => e.entidade === entidade).map((e) => e.entidadeId))];
  const idsDeValor = new Set<string>();
  for (const e of eventos) {
    if (e.campo !== "fabricaId" && e.campo !== "clienteId" && e.campo !== "fabricasIds") continue;
    for (const v of [e.valorAnterior, e.valorNovo]) v?.split(",").forEach((id) => id && idsDeValor.add(id));
  }

  const [pedidos, itens, notas, clientes, fabricas, usuarios, fabricasValor, clientesValor] = await Promise.all([
    prisma.pedido.findMany({ where: { id: { in: ids("Pedido") } }, include: { fabrica: true, cliente: true } }),
    prisma.itemPedido.findMany({ where: { id: { in: ids("ItemPedido") } }, include: { pedido: true } }),
    prisma.notaFiscal.findMany({ where: { id: { in: ids("NotaFiscal") } } }),
    prisma.cliente.findMany({ where: { id: { in: ids("Cliente") } } }),
    prisma.fabrica.findMany({ where: { id: { in: ids("Fabrica") } } }),
    prisma.usuario.findMany({ where: { id: { in: ids("Usuario") } } }),
    prisma.fabrica.findMany({ where: { id: { in: [...idsDeValor] } }, select: { id: true, nome: true } }),
    prisma.cliente.findMany({ where: { id: { in: [...idsDeValor] } }, select: { id: true, nomeFantasia: true } }),
  ]);

  const registros: Record<string, string> = {};
  for (const p of pedidos) registros[p.id] = `${numeroPedido(p)} · ${p.fabrica.nome} · ${p.cliente.nomeFantasia}`;
  for (const i of itens) registros[i.id] = `${i.referencia} do pedido ${numeroPedido(i.pedido)}`;
  for (const n of notas) registros[n.id] = n.numero;
  for (const c of clientes) registros[c.id] = c.nomeFantasia;
  for (const f of fabricas) registros[f.id] = f.nome;
  for (const u of usuarios) registros[u.id] = u.nome;

  const valores: Record<string, string> = {};
  for (const f of fabricasValor) valores[f.id] = f.nome;
  for (const c of clientesValor) valores[c.id] = c.nomeFantasia;

  return { registros, valores };
}
