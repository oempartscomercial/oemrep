import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import {
  cabecalhoDesafio,
  desafioDoVerificador,
  lerFormulario,
  metadadosRecurso,
  metadadosServidor,
  pkceConfere,
  recursoConfere,
  recursoDoMcp,
  redirectUriAceita,
  urlComParametros,
  validarPedidoAutorizacao,
  validarRegistro,
  venceu,
} from "../oauth";

const ORIGEM = "https://oem.exemplo.com.br";
const VERIFICADOR = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
// Exemplo do apêndice B da RFC 7636.
const DESAFIO = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";

describe("PKCE S256", () => {
  it("calcula o desafio como na RFC 7636", () => {
    expect(desafioDoVerificador(VERIFICADOR)).toBe(DESAFIO);
  });

  it("confere o verificador certo e recusa o errado, curto ou com caractere estranho", () => {
    expect(pkceConfere(VERIFICADOR, DESAFIO)).toBe(true);
    expect(pkceConfere(VERIFICADOR.replace("d", "e"), DESAFIO)).toBe(false);
    expect(pkceConfere("curto", desafioDoVerificador("curto"))).toBe(false);
    const comEspaco = "a".repeat(42) + " ";
    expect(pkceConfere(comEspaco, createHash("sha256").update(comEspaco).digest("base64url"))).toBe(false);
    expect(pkceConfere(VERIFICADOR, "")).toBe(false);
    expect(pkceConfere(undefined, DESAFIO)).toBe(false);
  });
});

describe("redirect_uri", () => {
  it("aceita https e http só no próprio computador", () => {
    for (const ok of [
      "https://claude.ai/api/mcp/auth_callback",
      "https://claude.com/api/mcp/auth_callback",
      "http://localhost:53124/callback",
      "http://127.0.0.1:8080/callback",
      "http://[::1]:9000/callback",
    ]) {
      expect(redirectUriAceita(ok)).toBe(true);
    }
  });

  it("recusa http em outro host, outros esquemas, fragmento, usuário na URL e lixo", () => {
    for (const ruim of [
      "http://evil.com/callback",
      "http://localhost.evil.com/callback",
      "javascript:alert(1)",
      "custom-app://callback",
      "https://claude.ai/cb#x",
      "https://user:senha@claude.ai/cb",
      "nada",
      "",
      `https://claude.ai/${"a".repeat(600)}`,
    ]) {
      expect(redirectUriAceita(ruim)).toBe(false);
    }
  });
});

describe("registro dinâmico (RFC 7591)", () => {
  it("aceita nome e redirects válidos, limpa o nome e tira repetidos", () => {
    expect(validarRegistro({ client_name: "  Claude   Code ", redirect_uris: ["http://localhost:1/callback", "http://localhost:1/callback"] })).toEqual({
      ok: true,
      nome: "Claude Code",
      redirectUris: ["http://localhost:1/callback"],
    });
  });

  it("dá um nome quando não vem e corta nome comprido", () => {
    const r = validarRegistro({ redirect_uris: ["https://claude.ai/api/mcp/auth_callback"] });
    expect(r.ok && r.nome).toBe("Aplicativo sem nome");
    const longo = validarRegistro({ client_name: "x".repeat(300), redirect_uris: ["https://claude.ai/cb"] });
    expect(longo.ok && longo.nome.length).toBe(80);
  });

  it("recusa sem redirect, com redirect proibido, com redirects demais e corpo que não é objeto", () => {
    expect(validarRegistro({ client_name: "x" })).toMatchObject({ ok: false, erro: "invalid_redirect_uri" });
    expect(validarRegistro({ redirect_uris: [] })).toMatchObject({ ok: false, erro: "invalid_redirect_uri" });
    expect(validarRegistro({ redirect_uris: ["http://evil.com/cb"] })).toMatchObject({ ok: false, erro: "invalid_redirect_uri" });
    expect(validarRegistro({ redirect_uris: Array.from({ length: 11 }, (_, i) => `https://claude.ai/cb${i}`) })).toMatchObject({ ok: false, erro: "invalid_redirect_uri" });
    expect(validarRegistro({ redirect_uris: [123] })).toMatchObject({ ok: false, erro: "invalid_redirect_uri" });
    expect(validarRegistro(null)).toMatchObject({ ok: false, erro: "invalid_client_metadata" });
    expect(validarRegistro("texto")).toMatchObject({ ok: false, erro: "invalid_client_metadata" });
    expect(validarRegistro({ client_name: 5, redirect_uris: ["https://claude.ai/cb"] })).toMatchObject({ ok: false, erro: "invalid_client_metadata" });
  });
});

describe("recurso (RFC 8707) e metadados", () => {
  it("o recurso é o /api/mcp desta origem; ausente vale; barra final tolerada", () => {
    expect(recursoDoMcp(`${ORIGEM}/`)).toBe(`${ORIGEM}/api/mcp`);
    expect(recursoConfere(undefined, ORIGEM)).toBe(true);
    expect(recursoConfere("", ORIGEM)).toBe(true);
    expect(recursoConfere(`${ORIGEM}/api/mcp`, ORIGEM)).toBe(true);
    expect(recursoConfere(`${ORIGEM}/api/mcp/`, ORIGEM)).toBe(true);
    expect(recursoConfere("https://outro.com/api/mcp", ORIGEM)).toBe(false);
    expect(recursoConfere(`${ORIGEM}/api/outra`, ORIGEM)).toBe(false);
  });

  it("metadados do recurso protegido (RFC 9728) e do servidor de autorização (RFC 8414)", () => {
    expect(metadadosRecurso(ORIGEM)).toMatchObject({ resource: `${ORIGEM}/api/mcp`, authorization_servers: [ORIGEM], scopes_supported: ["crm"] });
    expect(metadadosServidor(ORIGEM)).toEqual({
      issuer: ORIGEM,
      authorization_endpoint: `${ORIGEM}/oauth/autorizar`,
      token_endpoint: `${ORIGEM}/oauth/token`,
      registration_endpoint: `${ORIGEM}/oauth/register`,
      revocation_endpoint: `${ORIGEM}/oauth/revogar`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"],
      revocation_endpoint_auth_methods_supported: ["none"],
      scopes_supported: ["crm"],
    });
  });

  it("desafio do 401 aponta para os metadados; com token ruim, diz invalid_token", () => {
    expect(cabecalhoDesafio(ORIGEM)).toBe(`Bearer resource_metadata="${ORIGEM}/.well-known/oauth-protected-resource"`);
    expect(cabecalhoDesafio(ORIGEM, true)).toBe(`Bearer resource_metadata="${ORIGEM}/.well-known/oauth-protected-resource", error="invalid_token"`);
  });
});

describe("pedido de autorização", () => {
  const cliente = { id: "cli1", redirectUris: ["https://claude.ai/api/mcp/auth_callback"] };
  const base = {
    client_id: "cli1",
    redirect_uri: "https://claude.ai/api/mcp/auth_callback",
    response_type: "code",
    code_challenge: DESAFIO,
    code_challenge_method: "S256",
    state: "xyz",
    resource: `${ORIGEM}/api/mcp`,
  };
  const pedir = (mudar: Record<string, string | undefined>, c: typeof cliente | null = cliente) =>
    validarPedidoAutorizacao(new URLSearchParams(Object.entries({ ...base, ...mudar }).filter(([, v]) => v !== undefined) as [string, string][]), c, ORIGEM);

  it("pedido completo passa", () => {
    expect(pedir({})).toEqual({
      ok: true,
      pedido: { clientId: "cli1", redirectUri: base.redirect_uri, state: "xyz", codeChallenge: DESAFIO, recurso: `${ORIGEM}/api/mcp` },
    });
  });

  it("sem resource, assume o /api/mcp; sem redirect_uri e com um só cadastrado, usa ele", () => {
    const r = pedir({ resource: undefined, redirect_uri: undefined, state: undefined });
    expect(r).toEqual({ ok: true, pedido: { clientId: "cli1", redirectUri: base.redirect_uri, state: null, codeChallenge: DESAFIO, recurso: `${ORIGEM}/api/mcp` } });
  });

  it("cliente desconhecido ou redirect_uri diferente do cadastrado: mostra o erro, nunca redireciona", () => {
    expect(pedir({}, null)).toMatchObject({ ok: false, redirecionar: false });
    expect(pedir({ client_id: undefined })).toMatchObject({ ok: false, redirecionar: false });
    expect(pedir({ redirect_uri: "https://claude.ai/api/mcp/auth_callback/outro" })).toMatchObject({ ok: false, redirecionar: false });
    expect(pedir({ redirect_uri: "https://evil.com/cb" })).toMatchObject({ ok: false, redirecionar: false });
  });

  it("os outros erros voltam para o redirect_uri com error e state", () => {
    const erro = (r: ReturnType<typeof pedir>) => {
      if (r.ok || !r.redirecionar) throw new Error("esperava redirecionar");
      return Object.fromEntries(new URL(r.url).searchParams);
    };
    expect(erro(pedir({ response_type: "token" }))).toMatchObject({ error: "unsupported_response_type", state: "xyz" });
    expect(erro(pedir({ code_challenge: undefined }))).toMatchObject({ error: "invalid_request", state: "xyz" });
    expect(erro(pedir({ code_challenge_method: "plain" }))).toMatchObject({ error: "invalid_request" });
    expect(erro(pedir({ code_challenge_method: undefined }))).toMatchObject({ error: "invalid_request" });
    expect(erro(pedir({ code_challenge: "curto" }))).toMatchObject({ error: "invalid_request" });
    expect(erro(pedir({ resource: "https://outro.com/api/mcp" }))).toMatchObject({ error: "invalid_target" });
    expect(new URL((pedir({ response_type: "token" }) as { url: string }).url).origin + "/api/mcp/auth_callback").toBe(base.redirect_uri);
  });
});

describe("utilitários", () => {
  it("urlComParametros mantém a query que já existe e ignora vazios", () => {
    expect(urlComParametros("http://localhost:1/cb?a=1", { code: "c d", state: null })).toBe("http://localhost:1/cb?a=1&code=c+d");
  });

  it("lerFormulario lê form-urlencoded e JSON; JSON quebrado vira vazio", () => {
    expect(lerFormulario("application/x-www-form-urlencoded", "grant_type=refresh_token&refresh_token=a%2Bb")).toEqual({ grant_type: "refresh_token", refresh_token: "a+b" });
    expect(lerFormulario("application/json; charset=utf-8", '{"grant_type":"authorization_code","code":"x","n":1}')).toEqual({ grant_type: "authorization_code", code: "x" });
    expect(lerFormulario("application/json", "{quebrado")).toEqual({});
  });

  it("venceu: data no passado ou agora; sem data não vence", () => {
    const agora = new Date("2026-10-14T12:00:00Z");
    expect(venceu(new Date("2026-10-14T11:59:59Z"), agora)).toBe(true);
    expect(venceu(agora, agora)).toBe(true);
    expect(venceu(new Date("2026-10-14T12:00:01Z"), agora)).toBe(false);
    expect(venceu(null, agora)).toBe(false);
  });
});
