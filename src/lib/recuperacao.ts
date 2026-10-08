import { createClient } from "@supabase/supabase-js";
import { traduzirErroAuth } from "@/domain/auth/mensagens";

// Parte do cliente que o pedido de recuperação usa; permite testar sem rede.
export type ClienteDeRecuperacao = {
  auth: {
    resetPasswordForEmail(email: string, opcoes: { redirectTo: string }): Promise<{ error: { message: string; status?: number } | null }>;
  };
};

export type ResultadoRecuperacao = { ok: true } | { ok: false; mensagem: string };

// Pedido feito NO SERVIDOR e em fluxo implícito, de propósito. Pedido pelo navegador (PKCE)
// amarra o link ao navegador que pediu: o Rômulo pedia no e-mail do celular e abria no
// Safari, e o link vinha "expirado" na hora. No fluxo implícito o link chega com os tokens
// no fragmento (#access_token) e vale em qualquer navegador; /login/nova-senha já lê assim.
export function criarClienteDeRecuperacao(): ClienteDeRecuperacao | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !chave) return null;
  return createClient(url, chave, { auth: { flowType: "implicit", autoRefreshToken: false, persistSession: false } });
}

export async function pedirRecuperacao(cliente: ClienteDeRecuperacao | null, email: string, origem: string): Promise<ResultadoRecuperacao> {
  if (!cliente) return { ok: false, mensagem: "Não foi possível falar com o servidor agora. Tente de novo." };
  const { error } = await cliente.auth.resetPasswordForEmail(email, { redirectTo: `${origem}/login/nova-senha` });
  if (!error) return { ok: true };
  return { ok: false, mensagem: traduzirErroAuth(error) };
}
