import { cnpjValido } from "./cnpj";

export type DadosFabrica = { nome: string; cnpj: string };

export function validarDadosFabrica(dados: DadosFabrica): string[] {
  const erros: string[] = [];
  if (!dados.nome.trim()) erros.push("Nome é obrigatório.");
  if (!cnpjValido(dados.cnpj)) erros.push("CNPJ inválido.");
  return erros;
}
