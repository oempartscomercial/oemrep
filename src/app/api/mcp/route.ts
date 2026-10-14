import { responderMcp } from "@/lib/mcp/http";

// Servidor MCP do CRM para o Claude Code: token no cabeçalho Authorization: Bearer.
// Fora do proxy de login (src/lib/auth-guard.ts): a rota se protege pelo token.
export const dynamic = "force-dynamic";

const tratar = (request: Request) => responderMcp(request);
export { tratar as GET, tratar as POST, tratar as DELETE };
