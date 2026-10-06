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
    if (!pendencia) {
      return { itemNFe, pendencia, divergencias: ["Item não encontrado em nenhum pedido pendente deste cliente."] };
    }

    return { itemNFe, pendencia, divergencias: divergenciasDoVinculo(itemNFe, pendencia) };
  });
}

function divergenciasDoVinculo(itemNFe: ItemNFe, pendencia: PendenciaItem): string[] {
  const divergencias: string[] = [];
  if (itemNFe.valorUnitario !== pendencia.valorUnitario) {
    divergencias.push(
      `Valor unitário diverge: NFe R$ ${itemNFe.valorUnitario.toFixed(2)} × pedido R$ ${pendencia.valorUnitario.toFixed(2)}.`,
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
    if (pendencia.referencia !== resultado.itemNFe.referencia) {
      divergencias.unshift(
        `Referência diferente: NFe ${resultado.itemNFe.referencia} × pedido ${pendencia.referencia} (vínculo manual).`,
      );
    }
    conferencia.push({ itemNFe: resultado.itemNFe, pendencia, divergencias });
  }
  return { conferencia };
}
