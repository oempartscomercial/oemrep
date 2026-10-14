import { responderMcp } from "@/lib/mcp/http";

// Mesmo servidor MCP, com o token no caminho: o conector personalizado do claude.ai não deixa
// configurar cabeçalho. Não registre a URL nem o parâmetro em log: o token é o segredo.
export const dynamic = "force-dynamic";

type Contexto = { params: Promise<{ token: string }> };

async function tratar(request: Request, { params }: Contexto) {
  const { token } = await params;
  return responderMcp(request, token);
}
export { tratar as GET, tratar as POST, tratar as DELETE };
