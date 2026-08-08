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
    const divergencias: string[] = [];

    if (!pendencia) {
      divergencias.push("Item não encontrado em nenhum pedido pendente deste cliente.");
      return { itemNFe, pendencia, divergencias };
    }

    jaConsumidas.add(pendencia.itemPedidoId);

    if (emCentavos(itemNFe.valorUnitario) !== emCentavos(pendencia.valorUnitario)) {
      divergencias.push(
        `Valor unitário diverge: NFe ${formatarReais(itemNFe.valorUnitario)} × pedido ${formatarReais(pendencia.valorUnitario)}.`,
      );
    }
    if (itemNFe.quantidade > pendencia.quantidadePendente) {
      divergencias.push(
        `Quantidade faturada (${itemNFe.quantidade}) maior que a pendente (${pendencia.quantidadePendente}).`,
      );
    }

    return { itemNFe, pendencia, divergencias };
  });
}
