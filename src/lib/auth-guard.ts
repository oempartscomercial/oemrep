// /auth/confirm troca o token do e-mail (convite, recuperação) por sessão: é a entrada de
// quem ainda não está logado.
// /api/whatsapp recebe o webhook do transporte, que não tem sessão: a rota se protege
// por segredo próprio (src/lib/whatsapp/segredo.ts).
// /api/cron é chamado pelo cron da Vercel, sem sessão: protegido por CRON_SECRET.
// /api/mcp é o Claude (servidor MCP), sem sessão: protegido por token próprio (src/lib/mcp/tokens.ts).
// OAuth do Claude (ADR-017): metadados, registro, token e revogação são chamados pelo próprio
// Claude, sem sessão; a prova é o PKCE ou o token. A tela de Permitir (/oauth/autorizar) exige login.
const PUBLICAS = [
  "/login", "/auth", "/_next", "/favicon.ico", "/api/whatsapp", "/api/cron", "/api/mcp",
  "/.well-known", "/oauth/register", "/oauth/token", "/oauth/revogar", "/authorize",
];
export function rotaProtegida(pathname: string): boolean {
  return !PUBLICAS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

// Para onde o proxy manda quem chega sem sessão. Num GET, guarda o caminho em ?proximo= e o login
// volta para lá depois de entrar (é assim que a autorização do Claude continua depois do login).
// Só telas: API (exportação, por exemplo) não é destino de quem acabou de entrar.
// Quem lê o proximo valida de novo (caminhoInterno): a URL é do visitante.
export function caminhoDoLogin(pathname: string, search: string, metodo: string): string {
  if (metodo !== "GET" || pathname === "/" || pathname.startsWith("/api/")) return "/login";
  return `/login?proximo=${encodeURIComponent(pathname + search)}`;
}

// SKIP_AUTH (navegar sem login em dev local) nunca vale em produção, mesmo que a
// variável vaze para o ambiente da Vercel. Usado pelo proxy e pela sessão.
export function loginDispensado(env: { SKIP_AUTH?: string; NODE_ENV?: string }): boolean {
  return env.SKIP_AUTH === "true" && env.NODE_ENV !== "production";
}
