import { responderMcp } from "@/lib/mcp/http";

// Servidor MCP do CRM: token no cabeçalho Authorization: Bearer (access token do OAuth, ADR-017,
// ou token manual, ADR-016). Sem token, 401 apontando para os metadados do OAuth.
// Fora do proxy de login (src/lib/auth-guard.ts): a rota se protege pelo token.
export const dynamic = "force-dynamic";

const tratar = (request: Request) => responderMcp(request);
export { tratar as GET, tratar as POST, tratar as DELETE };
