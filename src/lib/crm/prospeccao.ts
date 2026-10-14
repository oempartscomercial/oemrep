import { prisma } from "@/lib/prisma";
import { compararCampos } from "@/domain/auditoria/evento";
import { cnpjValido, normalizarCnpj } from "@/domain/cadastro/cnpj";
import { normalizarUf, ufNorteNordeste } from "@/domain/crm/regiao";
import { nomeParecido } from "@/domain/crm/duplicidade";
import { textoOuNulo } from "./contatos";
import type { Autor } from "./empresas";

// Empresa nova em prospecção: entra "a avaliar" (CANDIDATA) e espera o Rômulo decidir se aborda.

export type EntradaNovaEmpresa = {
  nome: string;
  uf?: string | null;
  cidade?: string | null;
  cnpj?: string | null;
  site?: string | null;
  observacoes?: string | null;
  /** Já foi conferido que as parecidas são outras empresas. */
  mesmoAssim?: boolean;
};

export type Parecida = { id: string; nome: string; local: string; situacao: string };

export type ResultadoNovaEmpresa = { erros: string[]; id?: string; parecidas?: Parecida[]; avisos?: string[] };

const local = (c: { cidade: string | null; uf: string | null }) => [c.cidade, c.uf].filter(Boolean).join("/");

export async function criarEmpresaProspeccao(autor: Autor, entrada: EntradaNovaEmpresa): Promise<ResultadoNovaEmpresa> {
  const nome = entrada.nome.trim();
  const erros: string[] = [];
  if (!nome) erros.push("Informe o nome da empresa.");
  const uf = entrada.uf?.trim() ? normalizarUf(entrada.uf) : null;
  if (entrada.uf?.trim() && !uf) erros.push("UF inválida. Use a sigla do estado (ex.: PE).");
  const cnpj = entrada.cnpj?.trim() ? normalizarCnpj(entrada.cnpj) : null;
  if (entrada.cnpj?.trim() && !cnpjValido(entrada.cnpj)) erros.push("CNPJ inválido.");
  if (erros.length > 0) return { erros };

  if (cnpj) {
    const dono = await prisma.cliente.findUnique({ where: { cnpj } });
    if (dono) return { erros: [`Já existe uma empresa com este CNPJ: ${dono.nomeFantasia}.`], parecidas: [{ id: dono.id, nome: dono.nomeFantasia, local: local(dono), situacao: dono.situacao }] };
  }
  if (!entrada.mesmoAssim) {
    const todas = await prisma.cliente.findMany({ select: { id: true, nomeFantasia: true, cidade: true, uf: true, situacao: true }, orderBy: { nomeFantasia: "asc" } });
    const parecidas = todas.filter((c) => nomeParecido(nome, c.nomeFantasia)).slice(0, 8);
    if (parecidas.length > 0) {
      return {
        erros: ["Já existe empresa com nome parecido. Confirme que é outra antes de cadastrar."],
        parecidas: parecidas.map((p) => ({ id: p.id, nome: p.nomeFantasia, local: local(p), situacao: p.situacao })),
      };
    }
  }

  const dados = {
    nomeFantasia: nome,
    cnpj,
    situacao: "CANDIDATA" as const,
    uf,
    cidade: textoOuNulo(entrada.cidade),
    site: textoOuNulo(entrada.site),
    observacoes: textoOuNulo(entrada.observacoes),
    origem: autor.origem === "CLAUDE" ? "Claude" : null,
  };
  const criada = await prisma.$transaction(async (tx) => {
    const c = await tx.cliente.create({ data: dados });
    await tx.interacao.create({
      data: { clienteId: c.id, data: new Date(), canal: "OUTRO", resumo: "Empresa cadastrada para avaliação (prospecção).", origem: autor.origem, usuarioId: autor.id },
    });
    await tx.eventoAuditoria.createMany({ data: compararCampos("Cliente", c.id, autor.id, {}, dados) });
    return c;
  });

  const avisos: string[] = [];
  if (!uf) avisos.push("Sem UF: confirme o estado da empresa.");
  else if (!ufNorteNordeste(uf)) avisos.push("Fora do Norte e Nordeste: a linha Rudolph não pode ser oferecida a esta empresa (regra do contrato).");
  return { erros: [], id: criada.id, avisos };
}
