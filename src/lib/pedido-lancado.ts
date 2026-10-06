import type { Prisma } from "@prisma/client";

// Efeitos de um pedido lançado (manual ou por planilha) sobre o cadastro da empresa,
// dentro da mesma transação do pedido:
// - o vínculo cliente × fábrica passa a existir (base do funil de expansão);
// - empresa em prospecção vira CLIENTE no primeiro pedido, com registro na linha do
//   tempo marcado como automação (ADR-013).
export async function registrarEfeitosDoPedido(
  tx: Prisma.TransactionClient,
  pedido: { numero: string | null; clienteId: string; fabricaId: string },
): Promise<void> {
  const [cliente, fabrica] = await Promise.all([
    tx.cliente.findUniqueOrThrow({ where: { id: pedido.clienteId } }),
    tx.fabrica.findUniqueOrThrow({ where: { id: pedido.fabricaId } }),
  ]);

  await tx.clienteFabrica.upsert({
    where: { clienteId_fabricaId: { clienteId: cliente.id, fabricaId: fabrica.id } },
    update: {},
    create: { clienteId: cliente.id, fabricaId: fabrica.id },
  });

  // Carteira: chegou pedido desse cliente nessa fábrica, então a oportunidade aberta está ganha
  // (ADR-013). Os próximos passos dela deixam de valer.
  const abertas = await tx.oportunidade.findMany({
    where: { clienteId: cliente.id, fabricaId: fabrica.id, etapa: { notIn: ["GANHA", "PERDIDA"] } },
  });
  for (const o of abertas) {
    await tx.oportunidade.update({ where: { id: o.id }, data: { etapa: "GANHA", encerradaEm: new Date() } });
    await tx.proximoPasso.updateMany({ where: { oportunidadeId: o.id, concluidoEm: null }, data: { concluidoEm: new Date() } });
    await tx.interacao.create({
      data: {
        clienteId: cliente.id,
        oportunidadeId: o.id,
        data: new Date(),
        canal: "OUTRO",
        origem: "AUTOMACAO",
        resumo: `${fabrica.nome}: oportunidade ganha (movido automaticamente) — pedido ${pedido.numero ?? "S/N"} lançado.`,
      },
    });
  }

  if (cliente.situacao === "CLIENTE") return;
  await tx.cliente.update({ where: { id: cliente.id }, data: { situacao: "CLIENTE" } });
  await tx.interacao.create({
    data: {
      clienteId: cliente.id,
      data: new Date(),
      canal: "OUTRO",
      origem: "AUTOMACAO",
      resumo: `Primeiro pedido lançado (${pedido.numero ?? "S/N"}, ${fabrica.nome}): empresa passou a cliente.`,
    },
  });
}
