import { lerFormulario } from "@/domain/mcp/oauth";
import { origemDaRequisicao } from "@/lib/origem";
import { renovarAcesso, trocarCodigo } from "@/lib/mcp/oauth";
import { erroOAuth, lerCorpo, preflight, respostaJson } from "@/lib/mcp/oauth-http";

// Endpoint de token do OAuth: troca o código (com PKCE) e renova com rotação. Cliente público:
// o client_id vem no corpo (ou no Basic, se o cliente insistir; o segredo, se vier, é ignorado).
// Público (src/lib/auth-guard.ts): a prova é o código + verificador, ou o refresh token.
export const dynamic = "force-dynamic";

function clientIdDoBasic(cabecalho: string | null): string | undefined {
  const m = /^\s*basic\s+(\S+)\s*$/i.exec(cabecalho ?? "");
  if (!m) return undefined;
  const [id] = Buffer.from(m[1], "base64").toString("utf8").split(":");
  return id ? decodeURIComponent(id) : undefined;
}

export async function POST(request: Request) {
  const texto = await lerCorpo(request);
  if (texto === null) return erroOAuth(413, "invalid_request", "Corpo grande demais.");
  const f = lerFormulario(request.headers.get("content-type"), texto);
  const clientId = f.client_id ?? clientIdDoBasic(request.headers.get("authorization"));
  const origem = origemDaRequisicao(request);

  const r =
    f.grant_type === "authorization_code"
      ? await trocarCodigo({ codigo: f.code, clientId, redirectUri: f.redirect_uri, verificador: f.code_verifier, recurso: f.resource }, origem)
      : f.grant_type === "refresh_token"
        ? await renovarAcesso({ refresh: f.refresh_token, clientId, recurso: f.resource }, origem)
        : null;
  if (!r) return erroOAuth(400, "unsupported_grant_type", "Só authorization_code e refresh_token.");
  return r.ok ? respostaJson(r.resposta) : erroOAuth(r.status, r.erro, r.descricao);
}
export const OPTIONS = preflight;
