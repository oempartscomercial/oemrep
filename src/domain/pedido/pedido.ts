export type ItemPedidoInput = {
  referencia: string;
  descricao: string;
  quantidade: number;
  valorUnitario: number;
};

export type DadosPedido = {
  numero: string;
  semNumero: boolean;
  fabricaId: string;
  clienteId: string;
  itens: ItemPedidoInput[];
};

export function validarDadosPedido(dados: DadosPedido): string[] {
  const erros: string[] = [];

  if (!dados.semNumero && !dados.numero.trim()) {
    erros.push("Informe o número do pedido ou marque S/N.");
  }
  if (!dados.fabricaId) erros.push("Selecione a fábrica.");
  if (!dados.clienteId) erros.push("Selecione o cliente.");
  if (dados.itens.length === 0) erros.push("Adicione ao menos um item.");

  dados.itens.forEach((item, i) => {
    if (!item.referencia.trim()) erros.push(`Item ${i + 1}: referência é obrigatória.`);
    if (item.quantidade <= 0) erros.push(`Item ${i + 1}: quantidade deve ser maior que zero.`);
    if (item.valorUnitario < 0) erros.push(`Item ${i + 1}: valor unitário não pode ser negativo.`);
  });

  return erros;
}
