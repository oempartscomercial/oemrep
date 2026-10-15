import { metadadosServidor } from "@/domain/mcp/oauth";
import { origemDaRequisicao } from "@/lib/origem";
import { preflight, respostaJson } from "@/lib/mcp/oauth-http";

// RFC 8414: onde ficam autorização, token, registro e revogação. Público (src/lib/auth-guard.ts).
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return respostaJson(metadadosServidor(origemDaRequisicao(request)));
}
export const OPTIONS = preflight;
