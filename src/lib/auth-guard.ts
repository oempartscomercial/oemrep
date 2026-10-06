const PUBLICAS = ["/login", "/_next", "/favicon.ico"];
export function rotaProtegida(pathname: string): boolean {
  return !PUBLICAS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

// SKIP_AUTH (navegar sem login em dev local) nunca vale em produção, mesmo que a
// variável vaze para o ambiente da Vercel. Usado pelo proxy e pela sessão.
export function loginDispensado(env: { SKIP_AUTH?: string; NODE_ENV?: string }): boolean {
  return env.SKIP_AUTH === "true" && env.NODE_ENV !== "production";
}
