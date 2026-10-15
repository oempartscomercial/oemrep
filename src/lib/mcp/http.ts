import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { extrairBearer } from "@/domain/mcp/token";
import { cabecalhoDesafio } from "@/domain/mcp/oauth";
import { origemDaRequisicao } from "@/lib/origem";
import { autenticarToken } from "./tokens";
import { criarServidorMcp } from "./servidor";

// Ponto de entrada HTTP do MCP (Streamable HTTP, sem sessão: cabe numa função serverless).
// O token vem no cabeçalho Authorization (access token do OAuth ou token manual) ou no caminho
// /api/mcp/<token> (token manual no conector do claude.ai, o jeito antigo).
// Nada aqui registra a URL nem o token em log.

function erroJsonRpc(status: number, mensagem: string, desafio?: string): Response {
  return new Response(JSON.stringify({ jsonrpc: "2.0", error: { code: -32001, message: mensagem }, id: null }), {
    status,
    headers: { "content-type": "application/json", ...(desafio ? { "www-authenticate": desafio } : {}) },
  });
}

export async function responderMcp(request: Request, tokenDoCaminho?: string): Promise<Response> {
  // No /api/mcp, o 401 aponta para os metadados do OAuth (ADR-017): é assim que o Claude descobre
  // onde pedir autorização. No /api/mcp/<token> o token já veio no caminho; não há o que descobrir.
  const desafio = (tokenRuim: boolean) =>
    tokenDoCaminho === undefined ? cabecalhoDesafio(origemDaRequisicao(request), tokenRuim) : 'Bearer realm="oem"';
  const token = tokenDoCaminho ?? extrairBearer(request.headers.get("authorization"));
  if (!token) return erroJsonRpc(401, "Falta autorização. Conecte o Claude pela tela Conectar o Claude, na plataforma.", desafio(false));
  const auth = await autenticarToken(token);
  if (!auth.ok) return erroJsonRpc(auth.status, auth.mensagem, auth.status === 401 ? desafio(true) : undefined);

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
