// /api/whatsapp recebe o webhook do transporte, que não tem sessão: a rota se protege
// por segredo próprio (src/lib/whatsapp/segredo.ts).
const PUBLICAS = ["/login", "/_next", "/favicon.ico", "/api/whatsapp"];
export function rotaProtegida(pathname: string): boolean {
  return !PUBLICAS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

// SKIP_AUTH (navegar sem login em dev local) nunca vale em produção, mesmo que a
// variável vaze para o ambiente da Vercel. Usado pelo proxy e pela sessão.
export function loginDispensado(env: { SKIP_AUTH?: string; NODE_ENV?: string }): boolean {
  return env.SKIP_AUTH === "true" && env.NODE_ENV !== "production";
}
