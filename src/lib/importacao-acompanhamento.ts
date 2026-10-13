import type { PrismaClient } from "@prisma/client";
import { compararCampos } from "@/domain/auditoria/evento";
import { nomeDoCliente, pedidosEmAberto, type LinhaAcompanhamento } from "@/domain/importacao/acompanhamento";
import { registrarEfeitosDoPedido } from "./pedido-lancado";

export type ResumoImportacao = {
  clientesNovos: number;
  clientesExistentes: number;
  pedidosNovos: number;
  pedidosJaImportados: number;
  itens: number;
  saldo: number;
};

const OBSERVACAO = "Importado da planilha de acompanhamento do Zé.";

/**
 * Grava os pedidos em aberto da planilha de acompanhamento de uma fábrica. Pode rodar de
 * novo sem duplicar: pedido numerado é achado por fábrica + cliente + número; S/N por
 * fábrica + cliente + data do pedido, entre os que vieram de planilha.
 * Sem `aplicar`, só conta o que faria.
 */
export async function importarAcompanhamento(
  prisma: PrismaClient,
  opcoes: { fabricaId: string; usuarioId: string; linhas: LinhaAcompanhamento[]; aplicar: boolean },
): Promise<ResumoImportacao> {
  const pedidos = pedidosEmAberto(opcoes.linhas);
  const resumo: ResumoImportacao = { clientesNovos: 0, clientesExistentes: 0, pedidosNovos: 0, pedidosJaImportados: 0, itens: 0, saldo: 0 };

  const clientePorCnpj = new Map<string, string | null>();
  for (const cnpj of new Set(pedidos.map((p) => p.cnpj))) {
    const existente = await prisma.cliente.findUnique({ where: { cnpj }, select: { id: true } });
    if (existente) {
      resumo.clientesExistentes++;
      clientePorCnpj.set(cnpj, existente.id);
      continue;
    }
    resumo.clientesNovos++;
    if (!opcoes.aplicar) {
      clientePorCnpj.set(cnpj, null);
      continue;
    }
    const dados = nomeDoCliente(cnpj, pedidos.find((p) => p.cnpj === cnpj)!.fantasia);
    const cliente = await prisma.$transaction(async (tx) => {
      const criado = await tx.cliente.create({
        data: { cnpj, nomeFantasia: dados.nomeFantasia, uf: dados.uf, situacao: "CLIENTE", origem: "planilha de acompanhamento" },
      });
      await tx.eventoAuditoria.createMany({
        data: compararCampos("Cliente", criado.id, opcoes.usuarioId, {}, { nomeFantasia: criado.nomeFantasia, cnpj: criado.cnpj }),
      });
      return criado;
    });
    clientePorCnpj.set(cnpj, cliente.id);
  }

  for (const p of pedidos) {
    const clienteId = clientePorCnpj.get(p.cnpj) ?? null;
    if (clienteId) {
      const existente = p.numero
        ? await prisma.pedido.findUnique({
            where: { fabricaId_clienteId_numero: { fabricaId: opcoes.fabricaId, clienteId, numero: p.numero } },
            select: { id: true },
          })
        : await prisma.pedido.findFirst({
            where: { fabricaId: opcoes.fabricaId, clienteId, semNumero: true, origem: "EXCEL", dataPedido: p.dataPedido },
            select: { id: true },
          });
      if (existente) {
        resumo.pedidosJaImportados++;
        continue;
      }
    }

    resumo.pedidosNovos++;
    resumo.itens += p.itens.length;
    resumo.saldo += p.saldo;
    if (!opcoes.aplicar || !clienteId) continue;

    await prisma.$transaction(async (tx) => {
      const pedido = await tx.pedido.create({
        data: {
          numero: p.numero,
          semNumero: p.numero === null,
          origem: "EXCEL",
          estado: p.estado,
          fabricaId: opcoes.fabricaId,
          clienteId,
          dataPedido: p.dataPedido,
          observacao: OBSERVACAO,
          itens: {
            create: p.itens.map((i) => ({
              referencia: i.referencia,
              descricao: "",
              quantidadePedida: i.quantidadePedida,
              quantidadeFaturada: i.quantidadeFaturada,
              valorUnitario: i.valorUnitario,
              status: i.status,
            })),
          },
        },
      });
      await tx.eventoAuditoria.createMany({
        data: compararCampos("Pedido", pedido.id, opcoes.usuarioId, {}, {
          numero: pedido.numero,
          semNumero: pedido.semNumero,
          origem: pedido.origem,
          fabricaId: opcoes.fabricaId,
          clienteId,
        }),
      });
      await registrarEfeitosDoPedido(tx, pedido);
    }, { timeout: 30_000 });
  }

  resumo.saldo = Math.round(resumo.saldo * 100) / 100;
  return resumo;
}
