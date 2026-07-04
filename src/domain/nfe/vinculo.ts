export type PedidoParaVinculo = {
  id: string;
  clienteId: string;
};

// RN10: uma NFe pode cobrir itens de vários pedidos, desde que todos sejam do mesmo
// cliente. O CNPJ do destinatário já foi conferido em conferirItens (RN04); aqui só
// garantimos que os pedidos efetivamente vinculados não misturam clientes.
export function validarVinculoPedidos(pedidos: PedidoParaVinculo[]): string[] {
  if (pedidos.length === 0) {
    return ["Selecione ao menos um pedido para vincular à NFe."];
  }

  const clientesDistintos = new Set(pedidos.map((p) => p.clienteId));
  if (clientesDistintos.size > 1) {
    return ["Todos os pedidos vinculados a uma NFe devem ser do mesmo cliente."];
  }

  return [];
}
