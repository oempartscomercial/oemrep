import { prisma } from "@/lib/prisma";
import { sugerirExpansao } from "@/domain/crm/oportunidade";

const ABERTA = { notIn: ["GANHA", "PERDIDA"] as ("GANHA" | "PERDIDA")[] };

export async function buscarCarteira(fora: boolean) {
  return prisma.oportunidade.findMany({
    where: fora ? {} : { etapa: { in: ["A_ABORDAR", "ABORDADO", "INTERESSE", "COTACAO"] } },
    orderBy: [{ criadoEm: "asc" }],
    include: {
      cliente: true,
      fabrica: true,
      proximosPassos: { where: { concluidoEm: null }, orderBy: { prazo: "asc" }, take: 1, include: { responsavel: true } },
    },
  });
}

/** Clientes e fábricas para o diálogo de nova oportunidade. */
export async function dadosParaNovaOportunidade() {
  const [clientes, fabricas] = await Promise.all([
    prisma.cliente.findMany({
      where: { situacao: "CLIENTE" },
      orderBy: { nomeFantasia: "asc" },
      select: { id: true, nomeFantasia: true, fabricas: { select: { fabricaId: true } } },
    }),
    prisma.fabrica.findMany({ where: { ativo: true }, orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
  ]);
  return { clientes: clientes.map((c) => ({ id: c.id, nome: c.nomeFantasia, fabricaIds: c.fabricas.map((f) => f.fabricaId) })), fabricas };
}

/** Ideias de expansão: cliente × fábrica que ele ainda não compra (fato do cadastro, não previsão). */
export async function buscarSugestoes() {
  const [{ clientes, fabricas }, historico, abertas] = await Promise.all([
    dadosParaNovaOportunidade(),
    prisma.pedidoHistorico.groupBy({
      by: ["clienteId"],
      where: { suspeitaDuplicidade: false, tipo: "PEDIDO" },
      _sum: { valor: true },
    }),
    prisma.oportunidade.findMany({ where: { etapa: ABERTA }, select: { clienteId: true, fabricaId: true } }),
  ]);
  const valor = new Map(historico.map((h) => [h.clienteId, Number(h._sum.valor ?? 0)]));
  return sugerirExpansao(
    clientes.map((c) => ({ id: c.id, nome: c.nome, fabricaIds: c.fabricaIds, valorHistorico: valor.get(c.id) ?? 0 })),
    fabricas,
    new Set(abertas.map((o) => `${o.clienteId}|${o.fabricaId}`)),
  );
}
