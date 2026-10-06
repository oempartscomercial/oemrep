import { cnpjValido } from "./cnpj";

export type DadosCliente = {
  nomeFantasia: string;
  cnpj: string;
  fabricasIds: string[];
};

export function validarDadosCliente(dados: DadosCliente): string[] {
  const erros: string[] = [];
  if (!dados.nomeFantasia.trim()) erros.push("Nome fantasia é obrigatório.");
  // CNPJ é opcional (ADR-013): sem ele, é pedido na conferência da primeira NFe.
  if (dados.cnpj.trim() && !cnpjValido(dados.cnpj)) erros.push("CNPJ inválido.");
  if (dados.fabricasIds.length === 0) erros.push("Selecione ao menos uma fábrica.");
  return erros;
}
