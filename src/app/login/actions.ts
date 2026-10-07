"use server";

import { obterUsuarioLogado } from "@/lib/sessao";

// Logar no Supabase não basta: o acesso exige um Usuario ativo no cadastro (ADR-010).
// Chamado logo depois do login ou de criar a senha, para a pessoa saber o motivo em vez de
// cair em "Sessão expirada". Se recusar, quem chama encerra a sessão do Supabase.
export async function validarAcesso(): Promise<{ ok: true } | { ok: false; mensagem: string }> {
  const usuario = await obterUsuarioLogado();
  if (usuario) return { ok: true };
  return { ok: false, mensagem: "Seu e-mail ainda não tem acesso à plataforma, ou foi desativado. Fale com o administrador." };
}
