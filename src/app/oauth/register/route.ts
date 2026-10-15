import { registrarCliente } from "@/lib/mcp/oauth";
import { erroOAuth, lerCorpo, preflight, respostaJson } from "@/lib/mcp/oauth-http";

// Registro dinâmico de cliente (RFC 7591): o Claude se registra sozinho antes de pedir autorização.
// Público (src/lib/auth-guard.ts): registrar não dá acesso a nada, só um client_id para o
// "Permitir" da tela de consentimento.
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const texto = await lerCorpo(request);
  if (texto === null) return erroOAuth(413, "invalid_client_metadata", "Corpo grande demais.");
  let corpo: unknown;
  try {
    corpo = JSON.parse(texto);
  } catch {
    return erroOAuth(400, "invalid_client_metadata", "O corpo tem que ser JSON.");
  }
  const r = await registrarCliente(corpo);
  return r.ok ? respostaJson(r.resposta, 201) : erroOAuth(r.status, r.erro, r.descricao);
}
export const OPTIONS = preflight;
