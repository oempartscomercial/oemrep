import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { extrairBearer } from "@/domain/mcp/token";
import { autenticarToken } from "./tokens";
import { criarServidorMcp } from "./servidor";

// Ponto de entrada HTTP do MCP (Streamable HTTP, sem sessão: cabe numa função serverless).
// O token vem no cabeçalho Authorization (Claude Code) ou no caminho /api/mcp/<token>
// (conector personalizado do claude.ai, que não deixa configurar cabeçalho).
// Nada aqui registra a URL nem o token em log.

function erroJsonRpc(status: number, mensagem: string): Response {
  return new Response(JSON.stringify({ jsonrpc: "2.0", error: { code: -32001, message: mensagem }, id: null }), {
    status,
    headers: { "content-type": "application/json", ...(status === 401 ? { "www-authenticate": 'Bearer realm="oem"' } : {}) },
  });
}

export async function responderMcp(request: Request, tokenDoCaminho?: string): Promise<Response> {
  const token = tokenDoCaminho ?? extrairBearer(request.headers.get("authorization"));
  if (!token) return erroJsonRpc(401, "Falta o token. Gere um em Conectar o Claude, na plataforma.");
  const auth = await autenticarToken(token);
  if (!auth.ok) return erroJsonRpc(auth.status, auth.mensagem);

  // Sem sessão, não há fluxo de notificações do servidor para abrir com GET nem sessão para apagar.
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ jsonrpc: "2.0", error: { code: -32000, message: "Método não permitido." }, id: null }), {
      status: 405,
      headers: { "content-type": "application/json", allow: "POST" },
    });
  }

  const server = criarServidorMcp(auth.usuario);
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  try {
    return await transport.handleRequest(request);
  } finally {
    // Com resposta JSON, o corpo já está pronto quando handleRequest devolve.
    await server.close();
  }
}
