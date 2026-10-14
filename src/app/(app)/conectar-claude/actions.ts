"use server";

import { revalidatePath } from "next/cache";
import { obterUsuarioLogado } from "@/lib/sessao";
import { podeVerCrm } from "@/lib/authz";
import { criarToken, revogarToken } from "@/lib/mcp/tokens";

const SEM_SESSAO = "Sessão expirada. Faça login novamente.";
const SEM_PERMISSAO = "Você não tem permissão para acessar o CRM.";

/** Gera um acesso novo. O token volta só nesta resposta: a tela mostra uma vez e esquece. */
export async function gerarAcessoClaude(entrada: { nome: string }): Promise<{ erros: string[]; token?: string }> {
  const usuario = await obterUsuarioLogado();
  if (!usuario) return { erros: [SEM_SESSAO] };
  if (!podeVerCrm(usuario)) return { erros: [SEM_PERMISSAO] };
  const r = await criarToken(usuario, entrada.nome);
  if (r.erros.length > 0) return { erros: r.erros };
  revalidatePath("/conectar-claude");
  return { erros: [], token: r.token };
}

export async function revogarAcessoClaude(entrada: { id: string }): Promise<{ erros: string[] }> {
  const usuario = await obterUsuarioLogado();
  if (!usuario) return { erros: [SEM_SESSAO] };
  if (!podeVerCrm(usuario)) return { erros: [SEM_PERMISSAO] };
  const r = await revogarToken(usuario, entrada.id);
  if (r.erros.length === 0) revalidatePath("/conectar-claude");
  return r;
}
