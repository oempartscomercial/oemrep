import type { PerfilUsuario } from "@/lib/authz";

export type DadosUsuario = {
  nome: string;
  email: string;
  perfil: PerfilUsuario;
  fabricasIds: string[];
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validarDadosUsuario(dados: DadosUsuario): string[] {
  const erros: string[] = [];
  if (!dados.nome.trim()) erros.push("Nome é obrigatório.");
  if (!EMAIL_REGEX.test(dados.email)) erros.push("E-mail inválido.");
  if (dados.perfil !== "ADMIN" && dados.fabricasIds.length === 0) {
    erros.push("Operador e Analista precisam de ao menos uma fábrica.");
  }
  return erros;
}
