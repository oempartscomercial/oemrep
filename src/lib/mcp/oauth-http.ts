// Respostas HTTP dos endpoints do OAuth e dos metadados (.well-known): JSON, sem cache e com CORS
// aberto, porque o claude.ai faz parte das chamadas direto do navegador. Nada aqui usa cookie, então
// CORS aberto não expõe sessão de ninguém.

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "authorization, content-type, mcp-protocol-version",
  "access-control-max-age": "86400",
};

export function respostaJson(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store", pragma: "no-cache", ...CORS },
  });
}

/** Erro no formato do OAuth (RFC 6749 §5.2). */
export function erroOAuth(status: number, erro: string, descricao: string): Response {
  return respostaJson({ error: erro, error_description: descricao }, status);
}

/** 200 sem corpo (revogação, RFC 7009). */
export function respostaVazia(): Response {
  return new Response(null, { status: 200, headers: { "cache-control": "no-store", ...CORS } });
}

export function preflight(): Response {
  return new Response(null, { status: 204, headers: CORS });
}

const LIMITE_CORPO = 16 * 1024;

/** Lê o corpo como texto, até 16 KB. Maior que isso: null (quem chama responde 413/400). */
export async function lerCorpo(request: Request): Promise<string | null> {
  const declarado = Number(request.headers.get("content-length") ?? "0");
  if (declarado > LIMITE_CORPO) return null;
  const texto = await request.text();
  return texto.length > LIMITE_CORPO ? null : texto;
}
