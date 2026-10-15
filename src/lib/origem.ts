import { headers } from "next/headers";

// Endereço público do app, para montar links que vão por e-mail e os metadados do OAuth.
// NEXT_PUBLIC_SITE_URL manda quando existe (domínio próprio); senão vale o host da requisição.

type Cabecalhos = { get(nome: string): string | null };

function origemDosCabecalhos(h: Cabecalhos, padrao: { host: string; protocolo?: string }): string {
  const fixa = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "");
  if (fixa) return fixa;
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? padrao.host;
  const protocolo = h.get("x-forwarded-proto") ?? padrao.protocolo ?? (host.startsWith("localhost") ? "http" : "https");
  return `${protocolo}://${host}`;
}

export async function origemDoApp(): Promise<string> {
  return origemDosCabecalhos(await headers(), { host: "localhost:3000" });
}

/** Mesma conta, para route handlers: sem cabeçalho de host, vale a URL da própria requisição. */
export function origemDaRequisicao(request: Request): string {
  const url = new URL(request.url);
  return origemDosCabecalhos(request.headers, { host: url.host, protocolo: url.protocol.replace(":", "") });
}

/**
 * POST de formulário vindo do próprio site (proteção contra CSRF na tela de consentimento do
 * OAuth). Compara o Origin do navegador com o host que recebeu o pedido, como o Next faz nas
 * server actions. Sem Origin, só passa se o navegador disser same-origin.
 */
export function pedidoDoProprioSite(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return request.headers.get("sec-fetch-site") === "same-origin";
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? new URL(request.url).host;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
