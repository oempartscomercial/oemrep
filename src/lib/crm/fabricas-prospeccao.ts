import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { compararCampos } from "@/domain/auditoria/evento";
import type { FabricaDoFunil } from "@/domain/crm/fabrica-prospeccao";
import type { Autor } from "./empresas";

// Fábrica da prospecção (para qual fábrica a empresa está sendo prospectada). Mora no vínculo
// empresa × fábrica do cadastro (ClienteFabrica): para empresa em prospecção ele diz "prospectando
// para"; para cliente, "compra". A etapa do funil é uma só por empresa. Serve à tela e ao Claude.

export const ERRO_FABRICA_INVALIDA = "Fábrica desativada ou inexistente.";
const ERRO_CLIENTE =
  "Esta empresa já é cliente: as fábricas dela são as que compra. Para oferecer outra fábrica, use uma oportunidade da carteira.";

/** Fábricas que podem receber prospecção (ativas), em ordem de nome. */
export function listarFabricasAtivas() {
  return prisma.fabrica.findMany({ where: { ativo: true }, orderBy: { nome: "asc" }, select: { id: true, nome: true } });
}

/** Filtro do funil: empresas ligadas à fábrica, as ainda sem fábrica ("sem") ou todas. */
export function whereFabricaProspeccao(escolha: FabricaDoFunil): Prisma.ClienteWhereInput {
  if (escolha === "todas") return {};
  if (escolha === "sem") return { fabricas: { none: {} } };
  return { fabricas: { some: { fabricaId: escolha } } };
}

/** Confere que todas as fábricas existem e estão ativas. */
export async function fabricasValidas(ids: string[]): Promise<boolean> {
  const unicos = [...new Set(ids)];
  return unicos.length === 0 || (await prisma.fabrica.count({ where: { id: { in: unicos }, ativo: true } })) === unicos.length;
}

/** Inclui e tira fábricas da prospecção de uma empresa (não vale para cliente). Audita o campo. */
export async function ajustarFabricasProspeccao(
  autor: Pick<Autor, "id">,
  clienteId: string,
  mudanca: { incluir: string[]; tirar: string[] },
): Promise<{ erros: string[]; fabricas?: string[] }> {
  const empresa = await prisma.cliente.findUnique({ where: { id: clienteId }, include: { fabricas: { select: { fabricaId: true } } } });
  if (!empresa) return { erros: ["Empresa não encontrada."] };
  if (empresa.situacao === "CLIENTE") return { erros: [ERRO_CLIENTE] };
  if (!(await fabricasValidas(mudanca.incluir))) return { erros: [ERRO_FABRICA_INVALIDA] };

  const antes = empresa.fabricas.map((f) => f.fabricaId).sort();
  const depois = [...new Set([...antes.filter((f) => !mudanca.tirar.includes(f)), ...mudanca.incluir])].sort();
  if (antes.join(",") !== depois.join(",")) {
    await prisma.$transaction(async (tx) => {
      await tx.clienteFabrica.deleteMany({ where: { clienteId, fabricaId: { notIn: depois } } });
      await tx.clienteFabrica.createMany({ data: depois.filter((f) => !antes.includes(f)).map((fabricaId) => ({ clienteId, fabricaId })) });
      await tx.eventoAuditoria.createMany({ data: compararCampos("Cliente", clienteId, autor.id, { fabricasIds: antes.join(",") }, { fabricasIds: depois.join(",") }) });
    });
  }
  const nomes = await prisma.fabrica.findMany({ where: { id: { in: depois } }, orderBy: { nome: "asc" }, select: { nome: true } });
  return { erros: [], fabricas: nomes.map((f) => f.nome) };
}

type Cliente = Pick<PrismaClient, "cliente" | "clienteFabrica"> | Prisma.TransactionClient;

/**
 * Liga à fábrica toda empresa em prospecção ainda sem fábrica. Usado na carga da pasta rep, em que
 * toda a prospecção é Rudolph (a migração 20261017120000 faz o mesmo no banco que já existia).
 */
export async function ligarProspeccaoSemFabrica(db: Cliente, fabricaId: string): Promise<number> {
  const soltas = await db.cliente.findMany({ where: { situacao: { not: "CLIENTE" }, fabricas: { none: {} } }, select: { id: true } });
  const r = await db.clienteFabrica.createMany({ data: soltas.map((c) => ({ clienteId: c.id, fabricaId })), skipDuplicates: true });
  return r.count;
}
