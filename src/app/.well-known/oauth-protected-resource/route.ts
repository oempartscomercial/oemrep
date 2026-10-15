import { metadadosRecurso } from "@/domain/mcp/oauth";
import { origemDaRequisicao } from "@/lib/origem";
import { preflight, respostaJson } from "@/lib/mcp/oauth-http";

// RFC 9728: diz ao Claude que o /api/mcp é protegido e que quem autoriza é a própria plataforma.
// Público (src/lib/auth-guard.ts). A variante com o caminho (/api/mcp) devolve o mesmo.
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return respostaJson(metadadosRecurso(origemDaRequisicao(request)));
}
export const OPTIONS = preflight;
