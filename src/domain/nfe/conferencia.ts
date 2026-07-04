import type { ItemNFe } from "./parser";

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

// RN04: casamento por CNPJ do destinatário + referência. Quantidade e valor unitário
// divergentes viram alertas na tela de conferência, mas não bloqueiam o match — quem
// decide se a baixa segue é o operador (RF15).
export function conferirItens(
  destinatarioCnpj: string,
  itensNFe: ItemNFe[],
  pendencias: PendenciaItem[],
): ResultadoConferenciaItem[] {
  const pendenciasDoCliente = pendencias.filter((p) => p.clienteCnpj === destinatarioCnpj);

  return itensNFe.map((itemNFe) => {
    const pendencia = pendenciasDoCliente.find((p) => p.referencia === itemNFe.referencia) ?? null;
    const divergencias: string[] = [];

    if (!pendencia) {
      divergencias.push("Item não encontrado em nenhum pedido pendente deste cliente.");
      return { itemNFe, pendencia, divergencias };
    }

    if (itemNFe.valorUnitario !== pendencia.valorUnitario) {
      divergencias.push(
        `Valor unitário diverge: NFe R$ ${itemNFe.valorUnitario.toFixed(2)} × pedido R$ ${pendencia.valorUnitario.toFixed(2)}.`,
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
