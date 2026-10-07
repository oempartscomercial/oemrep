import { headers } from "next/headers";

// Endereço público do app, para montar links que vão por e-mail. NEXT_PUBLIC_SITE_URL
// manda quando existe (domínio próprio); senão vale o host da requisição.
export async function origemDoApp(): Promise<string> {
  const fixa = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "");
  if (fixa) return fixa;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const protocolo = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${protocolo}://${host}`;
}
