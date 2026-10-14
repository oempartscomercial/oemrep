"use server";

import { revalidatePath } from "next/cache";
import { obterUsuarioLogado, type UsuarioSessao } from "@/lib/sessao";
import { podeVerCrm } from "@/lib/authz";
import * as crm from "@/lib/crm/empresas";

// As regras moram em src/lib/crm/empresas.ts, que o Claude (servidor MCP) também usa.
// Aqui fica só o que é da tela: sessão, permissão e revalidação.

const SEM_SESSAO = "Sessão expirada. Faça login novamente.";
const SEM_PERMISSAO = "Você não tem permissão para acessar o CRM.";

export type PassoEntrada = crm.PassoEntrada;
export type Resultado = crm.Resultado;

async function sessaoCrm(): Promise<{ usuario: UsuarioSessao } | { erro: string }> {
  const usuario = await obterUsuarioLogado();
  if (!usuario) return { erro: SEM_SESSAO };
  if (!podeVerCrm(usuario)) return { erro: SEM_PERMISSAO };
  return { usuario };
}

const autor = (u: UsuarioSessao): crm.Autor => ({ id: u.id, nome: u.nome, origem: "USUARIO" });

function revalidar(clienteId: string) {
  revalidatePath("/funis");
  revalidatePath("/empresas");
  revalidatePath(`/empresas/${clienteId}`);
  revalidatePath("/");
}

export async function moverEmpresa(entrada: {
  clienteId: string;
  para: string;
  proximoPasso?: PassoEntrada | null;
  retomadaEm?: string | null;
  motivo?: string | null;
  naoContatar?: boolean;
}): Promise<Resultado> {
  const sessao = await sessaoCrm();
  if ("erro" in sessao) return { erros: [sessao.erro] };
  const r = await crm.moverEmpresa(autor(sessao.usuario), entrada);
  if (r.erros.length === 0) revalidar(entrada.clienteId);
  return r;
}

export async function registrarInteracao(entrada: {
  clienteId: string;
  canal: string;
  resumo: string;
  comQuem?: string | null;
  resultado?: string | null;
  proximoPasso?: PassoEntrada | null;
  /** Contato sobre uma oportunidade da carteira: o passo exigido e substituído é o dela. */
  oportunidadeId?: string | null;
}): Promise<Resultado> {
  const sessao = await sessaoCrm();
  if ("erro" in sessao) return { erros: [sessao.erro] };
  const r = await crm.registrarInteracao(autor(sessao.usuario), entrada);
  if (r.erros.length === 0) revalidar(entrada.clienteId);
  return { erros: r.erros };
}

/** Dá baixa no próximo passo. Empresa em andamento precisa já deixar o seguinte marcado. */
export async function concluirProximoPasso(entrada: { id: string; proximo?: PassoEntrada | null }): Promise<Resultado> {
  const sessao = await sessaoCrm();
  if ("erro" in sessao) return { erros: [sessao.erro] };
  const r = await crm.concluirProximoPasso(autor(sessao.usuario), entrada);
  if (r.clienteId) revalidar(r.clienteId);
  return { erros: r.erros };
}
