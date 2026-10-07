import { createClient } from "@supabase/supabase-js";

// Cliente com a chave de serviço do Supabase: pode criar e convidar usuários. Só roda no
// servidor (server actions e route handlers); a chave nunca tem prefixo NEXT_PUBLIC_.
export function criarClienteAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chave) return null;
  return createClient(url, chave, { auth: { autoRefreshToken: false, persistSession: false } });
}
