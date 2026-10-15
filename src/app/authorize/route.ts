// Atalho: cliente OAuth que não leu os metadados tenta /authorize (o padrão do SDK do MCP).
// Leva para a tela de autorização de verdade, com a mesma query. Público (src/lib/auth-guard.ts).
export function GET(request: Request) {
  const { search } = new URL(request.url);
  return new Response(null, { status: 307, headers: { location: `/oauth/autorizar${search}` } });
}
