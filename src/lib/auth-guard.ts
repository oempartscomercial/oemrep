const PUBLICAS = ["/login", "/_next", "/favicon.ico"];
export function rotaProtegida(pathname: string): boolean {
  return !PUBLICAS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}
