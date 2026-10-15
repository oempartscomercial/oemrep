import { createHash, timingSafeEqual } from "node:crypto";

// Regras do OAuth do servidor MCP (ADR-017), sem rede nem banco. A plataforma é ao mesmo
// tempo o recurso protegido (/api/mcp) e o servidor de autorização: o Claude descobre tudo
// pelos metadados, se registra sozinho (RFC 7591), manda a pessoa para a tela de
// consentimento e troca o código por tokens com PKCE S256 (cliente público, sem segredo).

export const ESCOPO = "crm";
export const VALIDADE_CODIGO_MS = 5 * 60_000;
export const VALIDADE_ACESSO_S = 60 * 60;
export const VALIDADE_RENOVACAO_MS = 90 * 24 * 60 * 60_000;

const semBarraFinal = (texto: string) => texto.replace(/\/+$/, "");

// ---------------------------------------------------------------- recurso e metadados

export function recursoDoMcp(origem: string): string {
  return `${semBarraFinal(origem)}/api/mcp`;
}

/** O `resource` (RFC 8707), se vier, tem que ser o /api/mcp desta origem. Ausente vale. */
export function recursoConfere(recurso: string | null | undefined, origem: string): boolean {
  if (!recurso) return true;
  return semBarraFinal(recurso) === recursoDoMcp(origem);
}

/** RFC 9728: /.well-known/oauth-protected-resource. */
export function metadadosRecurso(origem: string) {
  return {
    resource: recursoDoMcp(origem),
    authorization_servers: [semBarraFinal(origem)],
    scopes_supported: [ESCOPO],
    bearer_methods_supported: ["header"],
    resource_name: "CRM da OEM",
  };
}

/** RFC 8414: /.well-known/oauth-authorization-server. */
export function metadadosServidor(origem: string) {
  const o = semBarraFinal(origem);
  return {
    issuer: o,
    authorization_endpoint: `${o}/oauth/autorizar`,
    token_endpoint: `${o}/oauth/token`,
    registration_endpoint: `${o}/oauth/register`,
    revocation_endpoint: `${o}/oauth/revogar`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    revocation_endpoint_auth_methods_supported: ["none"],
    scopes_supported: [ESCOPO],
  };
}

/** WWW-Authenticate do 401 do /api/mcp: é por ele que o Claude descobre onde autorizar. */
export function cabecalhoDesafio(origem: string, tokenRuim = false): string {
  const base = `Bearer resource_metadata="${semBarraFinal(origem)}/.well-known/oauth-protected-resource"`;
  return tokenRuim ? `${base}, error="invalid_token"` : base;
}

// ---------------------------------------------------------------- PKCE (RFC 7636, só S256)

const VERIFICADOR = /^[A-Za-z0-9\-._~]{43,128}$/;
const DESAFIO = /^[A-Za-z0-9_-]{43}$/;

export function desafioDoVerificador(verificador: string): string {
  return createHash("sha256").update(verificador).digest("base64url");
}

export function pkceConfere(verificador: string | null | undefined, desafio: string | null | undefined): boolean {
  if (!verificador || !desafio || !VERIFICADOR.test(verificador) || !DESAFIO.test(desafio)) return false;
  const calculado = Buffer.from(desafioDoVerificador(verificador));
  const esperado = Buffer.from(desafio);
  return calculado.length === esperado.length && timingSafeEqual(calculado, esperado);
}

// ---------------------------------------------------------------- redirect_uri

const LOCAIS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** https em qualquer lugar (claude.ai) ou http só no próprio computador (Claude Code). */
export function redirectUriAceita(uri: string): boolean {
  if (!uri || uri.length > 500) return false;
  let url: URL;
  try {
    url = new URL(uri);
  } catch {
    return false;
  }
  if (url.hash || uri.includes("#") || url.username || url.password) return false;
  if (url.protocol === "https:") return true;
  return url.protocol === "http:" && LOCAIS.has(url.hostname);
}

// ---------------------------------------------------------------- registro dinâmico (RFC 7591)

const MAX_REDIRECTS = 10;
const MAX_NOME = 80;

export type RegistroValidado =
  | { ok: true; nome: string; redirectUris: string[] }
  | { ok: false; erro: "invalid_redirect_uri" | "invalid_client_metadata"; descricao: string };

export function validarRegistro(corpo: unknown): RegistroValidado {
  if (!corpo || typeof corpo !== "object" || Array.isArray(corpo)) {
    return { ok: false, erro: "invalid_client_metadata", descricao: "O corpo tem que ser um objeto JSON." };
  }
  const { client_name, redirect_uris } = corpo as Record<string, unknown>;
  if (client_name !== undefined && typeof client_name !== "string") {
    return { ok: false, erro: "invalid_client_metadata", descricao: "client_name tem que ser texto." };
  }
  if (!Array.isArray(redirect_uris) || redirect_uris.length === 0 || redirect_uris.length > MAX_REDIRECTS) {
    return { ok: false, erro: "invalid_redirect_uri", descricao: `Mande de 1 a ${MAX_REDIRECTS} redirect_uris.` };
  }
  if (!redirect_uris.every((u): u is string => typeof u === "string" && redirectUriAceita(u))) {
    return { ok: false, erro: "invalid_redirect_uri", descricao: "Só https:// ou http://localhost (ou 127.0.0.1), sem fragmento." };
  }
  const nome = (client_name ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_NOME) || "Aplicativo sem nome";
  return { ok: true, nome, redirectUris: [...new Set(redirect_uris)] };
}

// ---------------------------------------------------------------- pedido de autorização

export type PedidoAutorizacao = {
  clientId: string;
  redirectUri: string;
  state: string | null;
  codeChallenge: string;
  recurso: string;
};

export type ResultadoPedido =
  | { ok: true; pedido: PedidoAutorizacao }
  /** Cliente ou redirect_uri que não conferem: mostra o erro na tela, nunca redireciona. */
  | { ok: false; redirecionar: false; mensagem: string }
  /** Erro que o cliente precisa saber: volta para o redirect_uri com error e state. */
  | { ok: false; redirecionar: true; url: string };

type Parametros = { get(nome: string): string | null };

export function validarPedidoAutorizacao(
  params: Parametros,
  cliente: { id: string; redirectUris: string[] } | null,
  origem: string,
): ResultadoPedido {
  const clientId = params.get("client_id");
  if (!clientId || !cliente || cliente.id !== clientId) {
    return { ok: false, redirecionar: false, mensagem: "Este aplicativo não está registrado na plataforma. Volte ao Claude e tente conectar de novo." };
  }
  const pedida = params.get("redirect_uri");
  const redirectUri = pedida ?? (cliente.redirectUris.length === 1 ? cliente.redirectUris[0] : null);
  if (!redirectUri || !cliente.redirectUris.includes(redirectUri)) {
    return { ok: false, redirecionar: false, mensagem: "O endereço de volta não confere com o que o aplicativo registrou. Volte ao Claude e tente conectar de novo." };
  }

  const state = params.get("state");
  const erro = (error: string, descricao: string): ResultadoPedido => ({
    ok: false,
    redirecionar: true,
    url: urlComParametros(redirectUri, { error, error_description: descricao, state }),
  });

  if (params.get("response_type") !== "code") return erro("unsupported_response_type", "Só response_type=code.");
  const codeChallenge = params.get("code_challenge");
  if (!codeChallenge || !DESAFIO.test(codeChallenge)) return erro("invalid_request", "PKCE obrigatório: mande code_challenge.");
  if (params.get("code_challenge_method") !== "S256") return erro("invalid_request", "Só code_challenge_method=S256.");
  if (state !== null && state.length > 1000) return erro("invalid_request", "state comprido demais.");
  if (!recursoConfere(params.get("resource"), origem)) return erro("invalid_target", "resource tem que ser o /api/mcp desta plataforma.");

  return { ok: true, pedido: { clientId, redirectUri, state, codeChallenge, recurso: recursoDoMcp(origem) } };
}

// ---------------------------------------------------------------- utilitários

/** Acrescenta parâmetros à URL (mantém a query que já existe); nulos e vazios ficam de fora. */
export function urlComParametros(base: string, params: Record<string, string | null | undefined>): string {
  const url = new URL(base);
  for (const [nome, valor] of Object.entries(params)) if (valor) url.searchParams.set(nome, valor);
  return url.toString();
}

/** Corpo do /oauth/token e do /oauth/revogar: form-urlencoded (o padrão) ou JSON. Só textos. */
export function lerFormulario(tipo: string | null, texto: string): Record<string, string> {
  if ((tipo ?? "").toLowerCase().includes("application/json")) {
    try {
      const obj = JSON.parse(texto) as unknown;
      if (!obj || typeof obj !== "object") return {};
      return Object.fromEntries(Object.entries(obj).filter((e): e is [string, string] => typeof e[1] === "string"));
    } catch {
      return {};
    }
  }
  return Object.fromEntries(new URLSearchParams(texto));
}

export function venceu(data: Date | null | undefined, agora: Date): boolean {
  return !!data && data.getTime() <= agora.getTime();
}
