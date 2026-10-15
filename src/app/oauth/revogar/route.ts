import { lerFormulario } from "@/domain/mcp/oauth";
import { revogarPorSegredo } from "@/lib/mcp/oauth";
import { erroOAuth, lerCorpo, preflight, respostaVazia } from "@/lib/mcp/oauth-http";

// Revogação de token (RFC 7009): o Claude avisa quando a pessoa desconecta. Derruba o access e o
// refresh juntos. Responde 200 mesmo para token desconhecido, como manda a RFC.
// Público (src/lib/auth-guard.ts): ter o token é a prova.
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const texto = await lerCorpo(request);
  if (texto === null) return erroOAuth(413, "invalid_request", "Corpo grande demais.");
  const f = lerFormulario(request.headers.get("content-type"), texto);
  if (!f.token) return erroOAuth(400, "invalid_request", "Falta o token.");
  await revogarPorSegredo(f.token, f.client_id);
  return respostaVazia();
}
export const OPTIONS = preflight;
