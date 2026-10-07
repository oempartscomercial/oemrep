import type { ItemNFe } from "./parser";
import { emCentavos, formatarReais } from "../formato/moeda";

export type PendenciaItem = {
  itemPedidoId: string;
  pedidoId: string;
  clienteCnpj: string;
  referencia: string;
  quantidadePendente: number;
  valorUnitario: number;
};

export type ResultadoConferenciaItem = {
  itemNFe: ItemNFe;
  pendencia: PendenciaItem | null;
  divergencias: string[];
};

/** A referência vem de planilha, de PDF e do XML — chega com espaço sobrando e caixa trocada. */
function chaveReferencia(referencia: string): string {
  return referencia.trim().toLowerCase();
}

// RN04: casamento por CNPJ do destinatário + referência. Quantidade e valor unitário
// divergentes viram alertas na tela de conferência, mas não bloqueiam o match — quem
// decide se a baixa segue é o operador (RF15).
//
// RN10: uma NFe cobre vários pedidos do mesmo cliente. Cada pendência é consumida por no
// máximo uma linha da NFe, então duas linhas com a mesma referência caem em pedidos
// diferentes em vez de somarem baixa em dobro no mesmo item.
export function conferirItens(
  destinatarioCnpj: string,
  itensNFe: ItemNFe[],
  pendencias: PendenciaItem[],
): ResultadoConferenciaItem[] {
  const pendenciasDoCliente = pendencias.filter((p) => p.clienteCnpj === destinatarioCnpj);
  const jaConsumidas = new Set<string>();

  return itensNFe.map((itemNFe) => {
    const referencia = chaveReferencia(itemNFe.referencia);
    const pendencia =
      pendenciasDoCliente.find(
        (p) => chaveReferencia(p.referencia) === referencia && !jaConsumidas.has(p.itemPedidoId),
      ) ?? null;
    if (!pendencia) {
      return { itemNFe, pendencia, divergencias: ["Item não encontrado em nenhum pedido pendente deste cliente."] };
    }

    jaConsumidas.add(pendencia.itemPedidoId);
    return { itemNFe, pendencia, divergencias: divergenciasDoVinculo(itemNFe, pendencia) };
  });
}

function divergenciasDoVinculo(itemNFe: ItemNFe, pendencia: PendenciaItem): string[] {
  const divergencias: string[] = [];
  if (emCentavos(itemNFe.valorUnitario) !== emCentavos(pendencia.valorUnitario)) {
    divergencias.push(
      `Valor unitário diverge: NFe ${formatarReais(itemNFe.valorUnitario)} × pedido ${formatarReais(pendencia.valorUnitario)}.`,
    );
  }
  if (itemNFe.quantidade > pendencia.quantidadePendente) {
    divergencias.push(`Quantidade faturada (${itemNFe.quantidade}) maior que a pendente (${pendencia.quantidadePendente}).`);
  }
  return divergencias;
}

// RF16: antes da baixa, o operador pode trocar o vínculo de cada item da NFe (índice
// do item → id do item de pedido) ou desfazê-lo (null). Só vale escolher entre as
// pendências do próprio cliente nesta fábrica, calculadas no servidor.
export function aplicarVinculosManuais(
  destinatarioCnpj: string,
  itensNFe: ItemNFe[],
  pendencias: PendenciaItem[],
  escolhas: Record<number, string | null>,
): { conferencia?: ResultadoConferenciaItem[]; erro?: string } {
  const automatica = conferirItens(destinatarioCnpj, itensNFe, pendencias);
  const porId = new Map(pendencias.filter((p) => p.clienteCnpj === destinatarioCnpj).map((p) => [p.itemPedidoId, p]));

  const conferencia: ResultadoConferenciaItem[] = [];
  for (const [indice, resultado] of automatica.entries()) {
    if (!(indice in escolhas)) {
      conferencia.push(resultado);
      continue;
    }
    const escolhido = escolhas[indice];
    if (escolhido === null) {
      conferencia.push({ itemNFe: resultado.itemNFe, pendencia: null, divergencias: ["Item não será baixado (vínculo removido)."] });
      continue;
    }
    const pendencia = porId.get(escolhido);
    if (!pendencia) return { erro: "Um dos vínculos escolhidos não é um item pendente deste cliente nesta fábrica." };
    const divergencias = divergenciasDoVinculo(resultado.itemNFe, pendencia);
    if (chaveReferencia(pendencia.referencia) !== chaveReferencia(resultado.itemNFe.referencia)) {
      divergencias.unshift(
        `Referência diferente: NFe ${resultado.itemNFe.referencia} × pedido ${pendencia.referencia} (vínculo manual).`,
      );
    }
    conferencia.push({ itemNFe: resultado.itemNFe, pendencia, divergencias });
  }
  return { conferencia };
}
