import { cnpjValido, normalizarCnpj } from "../cadastro/cnpj";
import { numeroBr } from "../importacao/pdf";

/**
 * Pedido rápido: o pedido chegou como print de WhatsApp ou recado de vendedor, sem itens.
 * O operador registra só o que sabe (fábrica, cliente, valor, data) para o pedido entrar na
 * conta do "sem nota" e bater com a nota quando ela chegar. Os itens vêm depois — do PDF
 * do pedido ou da própria NFe — ou nunca.
 */
export type DadosPedidoRapido = {
  fabricaId: string;
  /** Cliente já cadastrado; vazio quando o operador está cadastrando um novo. */
  clienteId: string;
  /** Cadastro mínimo de cliente novo, feito no próprio formulário. */
  novoCliente?: { nome: string; cnpj: string } | null;
  /** Como digitado ("18.611,00"). */
  valorTotal: string;
  /** AAAA-MM-DD, do input type=date. */
  dataPedido: string;
  numero: string;
  numeroCliente: string;
  observacao: string;
};

export type PedidoRapidoValido = {
  fabricaId: string;
  clienteId: string | null;
  novoCliente: { nome: string; cnpj: string | null } | null;
  valorTotal: number;
  dataPedido: Date;
  numero: string | null;
  numeroCliente: string | null;
  observacao: string | null;
};

const hoje = () => new Date();

export function validarPedidoRapido(
  dados: DadosPedidoRapido,
  agora: Date = hoje(),
): { erros: string[]; valido?: PedidoRapidoValido } {
  const erros: string[] = [];

  if (!dados.fabricaId) erros.push("Escolha a fábrica.");

  const novo = dados.novoCliente;
  const nomeNovo = novo?.nome.trim() ?? "";
  const cnpjNovo = novo ? normalizarCnpj(novo.cnpj) : "";
  if (!dados.clienteId && !novo) erros.push("Escolha o cliente.");
  if (!dados.clienteId && novo) {
    if (!nomeNovo) erros.push("Escreva o nome do cliente novo.");
    if (cnpjNovo && !cnpjValido(cnpjNovo)) erros.push("O CNPJ do cliente novo não é válido. Confira ou deixe em branco.");
  }

  const valor = numeroBr(dados.valorTotal);
  if (valor === null) erros.push("Informe o valor total do pedido.");
  else if (valor <= 0) erros.push("O valor total tem de ser maior que zero.");

  // A data vem do input como AAAA-MM-DD; meio-dia evita virar o dia anterior no fuso.
  const data = /^\d{4}-\d{2}-\d{2}$/.test(dados.dataPedido) ? new Date(`${dados.dataPedido}T12:00:00-03:00`) : null;
  if (!data || Number.isNaN(data.getTime())) erros.push("Informe a data do pedido.");
  else if (data.getTime() - agora.getTime() > 24 * 60 * 60 * 1000) erros.push("A data do pedido está no futuro.");

  if (erros.length > 0) return { erros };

  const texto = (v: string) => v.trim() || null;
  return {
    erros: [],
    valido: {
      fabricaId: dados.fabricaId,
      clienteId: dados.clienteId || null,
      novoCliente: dados.clienteId ? null : { nome: nomeNovo, cnpj: cnpjNovo || null },
      valorTotal: valor!,
      dataPedido: data!,
      numero: texto(dados.numero),
      numeroCliente: texto(dados.numeroCliente),
      observacao: texto(dados.observacao),
    },
  };
}
