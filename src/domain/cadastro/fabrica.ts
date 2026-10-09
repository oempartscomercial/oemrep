import { cnpjValido } from "./cnpj";

export type DadosFabrica = { nome: string; cnpj: string };

export function validarDadosFabrica(dados: DadosFabrica): string[] {
  const erros: string[] = [];
  if (!dados.nome.trim()) erros.push("Nome é obrigatório.");
  if (!cnpjValido(dados.cnpj)) erros.push("CNPJ inválido.");
  return erros;
}

/**
 * Prazo da fábrica para emitir a nota, em dias. Campo vazio = usa o padrão global.
 * Devolve o número ou um erro para mostrar no formulário.
 */
export function lerSlaDiasSemNota(bruto: string): { valor: number | null } | { erro: string } {
  const texto = bruto.trim();
  if (!texto) return { valor: null };
  const dias = Number(texto);
  if (!Number.isInteger(dias) || dias < 1 || dias > 365) return { erro: "Prazo para emitir a nota: use um número inteiro de dias, de 1 a 365." };
  return { valor: dias };
}
