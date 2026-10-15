// Cadastro da empresa editado na própria ficha (nome, CNPJ, local, site e demais propriedades).
import { cnpjValido, normalizarCnpj } from "@/domain/cadastro/cnpj";
import { normalizarUf } from "./regiao";

export type EntradaCadastroEmpresa = {
  nome: string;
  cnpj: string;
  uf: string;
  cidade: string;
  site: string;
  grupo: string;
  origem: string;
  observacoes: string;
  fabricasIds: string[];
};

export type DadosCadastroEmpresa = {
  nomeFantasia: string;
  cnpj: string | null;
  uf: string | null;
  cidade: string | null;
  site: string | null;
  grupo: string | null;
  origem: string | null;
  observacoes: string | null;
};

const texto = (v: string) => (v.trim() ? v.trim() : null);

/** Valida e normaliza. Cliente precisa de fábrica (como no cadastro); empresa em prospecção, não. */
export function validarCadastroEmpresa(e: EntradaCadastroEmpresa, situacao: string): { erros: string[]; dados: DadosCadastroEmpresa } {
  const erros: string[] = [];
  if (!e.nome.trim()) erros.push("Informe o nome da empresa.");
  if (e.cnpj.trim() && !cnpjValido(e.cnpj)) erros.push("CNPJ inválido.");
  const uf = e.uf.trim() ? normalizarUf(e.uf) : null;
  if (e.uf.trim() && !uf) erros.push("UF inválida. Use a sigla do estado (ex.: PE).");
  if (situacao === "CLIENTE" && e.fabricasIds.length === 0) erros.push("Cliente precisa de ao menos uma fábrica.");
  return {
    erros,
    dados: {
      nomeFantasia: e.nome.trim(),
      cnpj: e.cnpj.trim() ? normalizarCnpj(e.cnpj) || null : null,
      uf,
      cidade: texto(e.cidade),
      site: texto(e.site),
      grupo: texto(e.grupo),
      origem: texto(e.origem),
      observacoes: texto(e.observacoes),
    },
  };
}

/** Endereço clicável do site, ou null quando o texto não parece um endereço. */
export function linkDoSite(site: string | null): string | null {
  const s = site?.trim();
  if (!s || /\s/.test(s) || !s.includes(".")) return null;
  return /^https?:\/\//i.test(s) ? s : `https://${s}`;
}
