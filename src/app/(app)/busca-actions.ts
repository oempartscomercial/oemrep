"use server";

import { obterUsuarioLogado } from "@/lib/sessao";
import { podeVerCrm } from "@/lib/authz";
import { buscaGlobal, type BuscaGlobal } from "./empresas/queries";

const VAZIO: BuscaGlobal = { empresas: [], contatos: [], pedidos: [] };

/** Busca da paleta ⌘K. Quem não vê o CRM só encontra pedidos (das fábricas que acompanha). */
export async function buscarGlobalAction(q: string): Promise<BuscaGlobal> {
  const usuario = await obterUsuarioLogado();
  if (!usuario) return VAZIO;
  const r = await buscaGlobal(usuario, q);
  return podeVerCrm(usuario) ? r : { ...VAZIO, pedidos: r.pedidos };
}
