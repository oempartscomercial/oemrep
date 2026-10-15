import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from "vitest";
import { randomBytes } from "node:crypto";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { UnauthorizedError, type OAuthClientProvider } from "@modelcontextprotocol/sdk/client/auth.js";
import type { OAuthClientInformationMixed, OAuthTokens } from "@modelcontextprotocol/sdk/shared/auth.js";
import { prisma } from "@/lib/prisma";
import { revogarToken } from "@/lib/mcp/tokens";
import { desafioDoVerificador } from "@/domain/mcp/oauth";

// O OAuth do MCP de ponta a ponta, em processo: as rotas do Next chamadas direto (fetch
// redirecionado para os handlers), banco de teste de verdade e sessão simulada na tela de Permitir.

const obterUsuarioLogadoMock = vi.fn();
vi.mock("@/lib/sessao", () => ({ obterUsuarioLogado: () => obterUsuarioLogadoMock() }));

import { GET as prmRaiz, OPTIONS as prmOptions } from "../../.well-known/oauth-protected-resource/route";
import { GET as prmCaminho } from "../../.well-known/oauth-protected-resource/api/mcp/route";
import { GET as asMetadados } from "../../.well-known/oauth-authorization-server/route";
import { POST as registrar } from "../register/route";
import { POST as token, OPTIONS as tokenOptions } from "../token/route";
import { POST as revogar } from "../revogar/route";
import { POST as decidir } from "../autorizar/decisao/route";
import { GET as authorizeAtalho } from "../../authorize/route";
import { POST as mcpPost } from "../../api/mcp/route";

const ORIGEM = "http://localhost:3000";
const SUFIXO = `oauth${Date.now().toString(36)}`;
const CALLBACK_CLAUDE = "https://claude.ai/api/mcp/auth_callback";
const CALLBACK_LOCAL = "http://localhost:53124/callback";

let romulo: { id: string; nome: string };
let operador: { id: string; nome: string };
const sessaoDe = (u: { id: string; nome: string }, perfil = "ANALISTA") => ({ id: u.id, nome: u.nome, perfil, fabricasIds: [] });

function fetchDasRotas(): typeof fetch {
  return async (input, init) => {
    const req = new Request(input as RequestInfo, init);
    const caminho = new URL(req.url).pathname;
    switch (caminho) {
      case "/.well-known/oauth-protected-resource":
        return prmRaiz(req);
      case "/.well-known/oauth-protected-resource/api/mcp":
        return prmCaminho(req);
      case "/.well-known/oauth-authorization-server":
        return asMetadados(req);
      case "/oauth/register":
        return registrar(req);
      case "/oauth/token":
        return token(req);
      case "/oauth/revogar":
        return revogar(req);
      case "/api/mcp":
        return mcpPost(req);
      default:
        return new Response("não encontrado", { status: 404 });
    }
  };
}
const chamar = fetchDasRotas();

async function registrarCliente(redirectUris = [CALLBACK_CLAUDE], nome = "Claude"): Promise<string> {
  const r = await chamar(`${ORIGEM}/oauth/register`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ client_name: nome, redirect_uris: redirectUris }) });
  expect(r.status).toBe(201);
  return ((await r.json()) as { client_id: string }).client_id;
}

/** O "clique" na tela de consentimento: POST do formulário, vindo do próprio site. */
async function decisao(campos: Record<string, string>, opcoes: { origin?: string | null } = {}) {
  const corpo = new URLSearchParams(campos);
  const headers: Record<string, string> = { "content-type": "application/x-www-form-urlencoded" };
  if (opcoes.origin !== null) headers.origin = opcoes.origin ?? ORIGEM;
  return decidir(new Request(`${ORIGEM}/oauth/autorizar/decisao`, { method: "POST", headers, body: corpo }));
}

function novoPkce() {
  const verificador = randomBytes(32).toString("base64url");
  return { verificador, desafio: desafioDoVerificador(verificador) };
}

const pedidoBase = (clientId: string, desafio: string, redirect = CALLBACK_CLAUDE) => ({
  client_id: clientId,
  redirect_uri: redirect,
  response_type: "code",
  code_challenge: desafio,
  code_challenge_method: "S256",
  state: "estado-123",
  resource: `${ORIGEM}/api/mcp`,
});

/** Registro → Permitir → código. */
async function obterCodigo(clientId: string, redirect = CALLBACK_CLAUDE) {
  const pkce = novoPkce();
  obterUsuarioLogadoMock.mockResolvedValue(sessaoDe(romulo));
  const r = await decisao({ ...pedidoBase(clientId, pkce.desafio, redirect), decisao: "permitir" });
  expect(r.status).toBe(303);
  const volta = new URL(r.headers.get("location")!);
  expect(volta.origin + volta.pathname).toBe(redirect);
  expect(volta.searchParams.get("state")).toBe("estado-123");
  return { codigo: volta.searchParams.get("code")!, ...pkce };
}

async function pedirToken(campos: Record<string, string>, json = false) {
  const r = await chamar(`${ORIGEM}/oauth/token`, {
    method: "POST",
    headers: { "content-type": json ? "application/json" : "application/x-www-form-urlencoded" },
    body: json ? JSON.stringify(campos) : new URLSearchParams(campos),
  });
  return { status: r.status, corpo: (await r.json()) as Record<string, string | number>, headers: r.headers };
}

async function trocar(clientId: string, c: { codigo: string; verificador: string }, mudar: Record<string, string> = {}) {
  return pedirToken({ grant_type: "authorization_code", code: c.codigo, client_id: clientId, redirect_uri: CALLBACK_CLAUDE, code_verifier: c.verificador, resource: `${ORIGEM}/api/mcp`, ...mudar });
}

const corpoInicializar = JSON.stringify({
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "teste", version: "0" } },
});
const statusMcp = async (acesso?: string) =>
  (
    await mcpPost(
      new Request(`${ORIGEM}/api/mcp`, {
        method: "POST",
        body: corpoInicializar,
        headers: { "content-type": "application/json", accept: "application/json, text/event-stream", ...(acesso ? { authorization: `Bearer ${acesso}` } : {}) },
      }),
    )
  ).status;

beforeAll(async () => {
  romulo = await prisma.usuario.create({ data: { nome: `Rômulo ${SUFIXO}`, email: `romulo-${SUFIXO}@teste.local`, perfil: "ANALISTA" } });
  operador = await prisma.usuario.create({ data: { nome: `Operador ${SUFIXO}`, email: `operador-${SUFIXO}@teste.local`, perfil: "OPERADOR" } });
}, 30000);

afterEach(() => obterUsuarioLogadoMock.mockReset());

afterAll(async () => {
  const usuarios = [romulo.id, operador.id];
  const tokens = await prisma.tokenApi.findMany({ where: { usuarioId: { in: usuarios } }, select: { clienteOAuthId: true } });
  await prisma.eventoAuditoria.deleteMany({ where: { usuarioId: { in: usuarios } } });
  await prisma.codigoOAuth.deleteMany({ where: { usuarioId: { in: usuarios } } });
  await prisma.tokenApi.deleteMany({ where: { usuarioId: { in: usuarios } } });
  const clientes = [...new Set(tokens.map((t) => t.clienteOAuthId).filter((id): id is string => !!id))];
  await prisma.clienteOAuth.deleteMany({ where: { OR: [{ id: { in: clientes } }, { nome: { contains: SUFIXO } }] } });
  await prisma.usuario.deleteMany({ where: { id: { in: usuarios } } });
}, 30000);

describe("descoberta", () => {
  it("/api/mcp sem token: 401 apontando para os metadados do recurso", async () => {
    const r = await mcpPost(new Request(`${ORIGEM}/api/mcp`, { method: "POST", body: corpoInicializar, headers: { "content-type": "application/json" } }));
    expect(r.status).toBe(401);
    expect(r.headers.get("www-authenticate")).toBe(`Bearer resource_metadata="${ORIGEM}/.well-known/oauth-protected-resource"`);
  });

  it("metadados do recurso (raiz e com caminho) e do servidor de autorização, com CORS e sem cache", async () => {
    for (const r of [await prmRaiz(new Request(`${ORIGEM}/.well-known/oauth-protected-resource`)), await prmCaminho(new Request(`${ORIGEM}/.well-known/oauth-protected-resource/api/mcp`))]) {
      expect(await r.json()).toMatchObject({ resource: `${ORIGEM}/api/mcp`, authorization_servers: [ORIGEM] });
      expect(r.headers.get("access-control-allow-origin")).toBe("*");
      expect(r.headers.get("cache-control")).toBe("no-store");
    }
    const as = (await (await asMetadados(new Request(`${ORIGEM}/.well-known/oauth-authorization-server`))).json()) as Record<string, unknown>;
    expect(as).toMatchObject({ issuer: ORIGEM, token_endpoint: `${ORIGEM}/oauth/token`, code_challenge_methods_supported: ["S256"] });
    expect(prmOptions().status).toBe(204);
    expect(tokenOptions().headers.get("access-control-allow-methods")).toContain("POST");
  });

  it("o host da requisição (atrás da Vercel) vira a origem dos metadados", async () => {
    const r = await asMetadados(new Request("http://interno/.well-known/oauth-authorization-server", { headers: { "x-forwarded-host": "oem.exemplo.com.br", "x-forwarded-proto": "https" } }));
    expect(((await r.json()) as { issuer: string }).issuer).toBe("https://oem.exemplo.com.br");
  });

  it("/authorize leva para /oauth/autorizar com a mesma query", async () => {
    const r = authorizeAtalho(new Request(`${ORIGEM}/authorize?client_id=x&state=y`));
    expect(r.status).toBe(307);
    expect(r.headers.get("location")).toBe("/oauth/autorizar?client_id=x&state=y");
  });
});

describe("registro dinâmico", () => {
  it("devolve client_id de cliente público; recusa redirect proibido e corpo que não é JSON", async () => {
    const ok = await chamar(`${ORIGEM}/oauth/register`, { method: "POST", body: JSON.stringify({ client_name: `Claude ${SUFIXO}`, redirect_uris: [CALLBACK_LOCAL] }) });
    expect(ok.status).toBe(201);
    expect(await ok.json()).toMatchObject({ client_name: `Claude ${SUFIXO}`, redirect_uris: [CALLBACK_LOCAL], token_endpoint_auth_method: "none" });

    const ruim = await chamar(`${ORIGEM}/oauth/register`, { method: "POST", body: JSON.stringify({ client_name: `x ${SUFIXO}`, redirect_uris: ["http://evil.com/cb"] }) });
    expect(ruim.status).toBe(400);
    expect(await ruim.json()).toMatchObject({ error: "invalid_redirect_uri" });

    const lixo = await chamar(`${ORIGEM}/oauth/register`, { method: "POST", body: "isto não é json" });
    expect(lixo.status).toBe(400);
    const grande = await chamar(`${ORIGEM}/oauth/register`, { method: "POST", body: JSON.stringify({ client_name: "x".repeat(20_000), redirect_uris: [CALLBACK_LOCAL] }) });
    expect(grande.status).toBe(413);
  });
});

describe("tela de Permitir (decisão)", () => {
  it("Cancelar volta com access_denied e o state", async () => {
    const clientId = await registrarCliente();
    obterUsuarioLogadoMock.mockResolvedValue(sessaoDe(romulo));
    const r = await decisao({ ...pedidoBase(clientId, novoPkce().desafio), decisao: "cancelar" });
    const volta = new URL(r.headers.get("location")!);
    expect(volta.searchParams.get("error")).toBe("access_denied");
    expect(volta.searchParams.get("state")).toBe("estado-123");
    expect(volta.searchParams.get("code")).toBeNull();
  });

  it("sem sessão, manda para o login com a volta para a autorização", async () => {
    const clientId = await registrarCliente();
    obterUsuarioLogadoMock.mockResolvedValue(null);
    const r = await decisao({ ...pedidoBase(clientId, novoPkce().desafio), decisao: "permitir" });
    const destino = r.headers.get("location")!;
    expect(destino.startsWith("/login?proximo=%2Foauth%2Fautorizar%3F")).toBe(true);
    expect(decodeURIComponent(destino)).toContain(`client_id=${clientId}`);
  });

  it("OPERADOR não autoriza: access_denied, sem código", async () => {
    const clientId = await registrarCliente();
    obterUsuarioLogadoMock.mockResolvedValue(sessaoDe(operador, "OPERADOR"));
    const r = await decisao({ ...pedidoBase(clientId, novoPkce().desafio), decisao: "permitir" });
    expect(new URL(r.headers.get("location")!).searchParams.get("error")).toBe("access_denied");
    expect(await prisma.codigoOAuth.count({ where: { usuarioId: operador.id } })).toBe(0);
  });

  it("POST de outro site (CSRF) é recusado; sem Origin e sem Sec-Fetch-Site também", async () => {
    const clientId = await registrarCliente();
    obterUsuarioLogadoMock.mockResolvedValue(sessaoDe(romulo));
    expect((await decisao({ ...pedidoBase(clientId, novoPkce().desafio), decisao: "permitir" }, { origin: "https://evil.com" })).status).toBe(403);
    expect((await decisao({ ...pedidoBase(clientId, novoPkce().desafio), decisao: "permitir" }, { origin: null })).status).toBe(403);
  });

  it("redirect_uri fora do registrado: erro na tela, nunca redireciona", async () => {
    const clientId = await registrarCliente();
    obterUsuarioLogadoMock.mockResolvedValue(sessaoDe(romulo));
    const r = await decisao({ ...pedidoBase(clientId, novoPkce().desafio, "https://evil.com/cb"), decisao: "permitir" });
    expect(r.status).toBe(400);
    expect(r.headers.get("location")).toBeNull();
  });

  it("sem PKCE, volta para o Claude com invalid_request", async () => {
    const clientId = await registrarCliente();
    obterUsuarioLogadoMock.mockResolvedValue(sessaoDe(romulo));
    const semPkce = Object.fromEntries(Object.entries(pedidoBase(clientId, "x")).filter(([campo]) => campo !== "code_challenge"));
    const r = await decisao({ ...semPkce, decisao: "permitir" });
    expect(new URL(r.headers.get("location")!).searchParams.get("error")).toBe("invalid_request");
  });
});

describe("token: código, renovação e revogação", () => {
  it("fluxo completo: código → tokens → MCP → renovação com rotação → revogação na tela → 401", async () => {
    const clientId = await registrarCliente();
    const c = await obterCodigo(clientId);
    const t1 = await trocar(clientId, c);
    expect(t1.status).toBe(200);
    expect(t1.headers.get("cache-control")).toBe("no-store");
    expect(t1.corpo).toMatchObject({ token_type: "Bearer", expires_in: 3600, scope: "crm" });
    expect(String(t1.corpo.access_token)).toMatch(/^oem_/);
    expect(String(t1.corpo.refresh_token)).toMatch(/^oemr_/);
    expect(await statusMcp(String(t1.corpo.access_token))).toBe(200);

    const salvo = await prisma.tokenApi.findFirstOrThrow({ where: { usuarioId: romulo.id, origem: "OAUTH", clienteOAuthId: clientId } });
    expect(salvo.nome).toBe("Claude");
    expect(salvo.ultimoUsoEm).not.toBeNull();
    expect(salvo.hash).not.toContain(String(t1.corpo.access_token).slice(4, 20));
    const criado = await prisma.eventoAuditoria.findMany({ where: { entidade: "TokenApi", entidadeId: salvo.id } });
    expect(criado.map((e) => [e.campo, e.valorNovo])).toEqual(expect.arrayContaining([["nome", "Claude"], ["origem", "OAUTH"]]));

    // Renovação (corpo JSON): o par antigo deixa de valer.
    const t2 = await pedirToken({ grant_type: "refresh_token", refresh_token: String(t1.corpo.refresh_token), client_id: clientId }, true);
    expect(t2.status).toBe(200);
    expect(t2.corpo.refresh_token).not.toBe(t1.corpo.refresh_token);
    expect(await statusMcp(String(t1.corpo.access_token))).toBe(401);
    expect(await statusMcp(String(t2.corpo.access_token))).toBe(200);
    const deNovo = await pedirToken({ grant_type: "refresh_token", refresh_token: String(t1.corpo.refresh_token), client_id: clientId });
    expect(deNovo).toMatchObject({ status: 400, corpo: { error: "invalid_grant" } });
    expect(await prisma.tokenApi.count({ where: { usuarioId: romulo.id, clienteOAuthId: clientId } })).toBe(1);

    // Renovação com client_id de outro aplicativo: não.
    const outroCliente = await registrarCliente();
    expect((await pedirToken({ grant_type: "refresh_token", refresh_token: String(t2.corpo.refresh_token), client_id: outroCliente })).corpo.error).toBe("invalid_grant");

    // Revogar na tela derruba access e refresh, e audita.
    expect((await revogarToken(sessaoDe(romulo) as never, salvo.id)).erros).toEqual([]);
    expect(await statusMcp(String(t2.corpo.access_token))).toBe(401);
    expect((await pedirToken({ grant_type: "refresh_token", refresh_token: String(t2.corpo.refresh_token), client_id: clientId })).corpo.error).toBe("invalid_grant");
    expect(await prisma.eventoAuditoria.count({ where: { entidade: "TokenApi", entidadeId: salvo.id, campo: "revogadoEm" } })).toBe(1);
  }, 30000);

  it("código reapresentado: invalid_grant e o acesso que ele gerou cai", async () => {
    const clientId = await registrarCliente();
    const c = await obterCodigo(clientId);
    const t = await trocar(clientId, c);
    expect(t.status).toBe(200);
    expect((await trocar(clientId, c)).corpo.error).toBe("invalid_grant");
    expect(await statusMcp(String(t.corpo.access_token))).toBe(401);
    expect((await pedirToken({ grant_type: "refresh_token", refresh_token: String(t.corpo.refresh_token), client_id: clientId })).corpo.error).toBe("invalid_grant");
  }, 15000);

  it("código vencido (mais de 5 minutos): invalid_grant", async () => {
    const clientId = await registrarCliente();
    const c = await obterCodigo(clientId);
    await prisma.codigoOAuth.updateMany({ where: { clienteOAuthId: clientId }, data: { expiraEm: new Date(Date.now() - 1000) } });
    expect(await trocar(clientId, c)).toMatchObject({ status: 400, corpo: { error: "invalid_grant", error_description: "Código vencido." } });
  });

  it("redirect_uri diferente, PKCE errado ou outro client_id: invalid_grant, e o código queima", async () => {
    const clientId = await registrarCliente([CALLBACK_CLAUDE, "https://claude.com/api/mcp/auth_callback"]);
    const outro = await registrarCliente();

    const a = await obterCodigo(clientId);
    expect((await trocar(clientId, a, { redirect_uri: "https://claude.com/api/mcp/auth_callback" })).corpo.error).toBe("invalid_grant");
    expect((await trocar(clientId, a)).corpo.error).toBe("invalid_grant"); // queimou na tentativa errada

    const b = await obterCodigo(clientId);
    expect((await trocar(clientId, { ...b, verificador: novoPkce().verificador })).corpo).toMatchObject({ error: "invalid_grant", error_description: "code_verifier não confere (PKCE)." });

    const c = await obterCodigo(clientId);
    expect((await trocar(outro, c)).corpo.error).toBe("invalid_grant");

    const d = await obterCodigo(clientId);
    expect((await trocar(clientId, d, { resource: "https://outro.com/api/mcp" })).corpo.error).toBe("invalid_target");
  }, 30000);

  it("access token vencido: 401 com invalid_token, e a renovação devolve o acesso", async () => {
    const clientId = await registrarCliente();
    const t = await trocar(clientId, await obterCodigo(clientId));
    await prisma.tokenApi.updateMany({ where: { clienteOAuthId: clientId }, data: { expiraEm: new Date(Date.now() - 1000) } });
    const r = await mcpPost(new Request(`${ORIGEM}/api/mcp`, { method: "POST", body: corpoInicializar, headers: { "content-type": "application/json", accept: "application/json, text/event-stream", authorization: `Bearer ${t.corpo.access_token}` } }));
    expect(r.status).toBe(401);
    expect(r.headers.get("www-authenticate")).toContain('error="invalid_token"');
    const novo = await pedirToken({ grant_type: "refresh_token", refresh_token: String(t.corpo.refresh_token), client_id: clientId });
    expect(await statusMcp(String(novo.corpo.access_token))).toBe(200);
  }, 15000);

  it("refresh vencido (90 dias) não renova", async () => {
    const clientId = await registrarCliente();
    const t = await trocar(clientId, await obterCodigo(clientId));
    await prisma.tokenApi.updateMany({ where: { clienteOAuthId: clientId }, data: { refreshExpiraEm: new Date(Date.now() - 1000) } });
    expect((await pedirToken({ grant_type: "refresh_token", refresh_token: String(t.corpo.refresh_token), client_id: clientId })).corpo.error).toBe("invalid_grant");
  });

  it("revogação RFC 7009 pelo refresh derruba os dois; token desconhecido também responde 200", async () => {
    const clientId = await registrarCliente();
    const t = await trocar(clientId, await obterCodigo(clientId));
    const r = await chamar(`${ORIGEM}/oauth/revogar`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ token: String(t.corpo.refresh_token), client_id: clientId }) });
    expect(r.status).toBe(200);
    expect(await statusMcp(String(t.corpo.access_token))).toBe(401);
    expect((await chamar(`${ORIGEM}/oauth/revogar`, { method: "POST", body: new URLSearchParams({ token: "qualquer" }) })).status).toBe(200);
  }, 15000);

  it("usuário desativado: o access para de valer e a renovação é recusada", async () => {
    const clientId = await registrarCliente();
    const t = await trocar(clientId, await obterCodigo(clientId));
    await prisma.usuario.update({ where: { id: romulo.id }, data: { ativo: false } });
    try {
      expect(await statusMcp(String(t.corpo.access_token))).toBe(401);
      expect((await pedirToken({ grant_type: "refresh_token", refresh_token: String(t.corpo.refresh_token), client_id: clientId })).corpo.error).toBe("invalid_grant");
    } finally {
      await prisma.usuario.update({ where: { id: romulo.id }, data: { ativo: true } });
    }
  }, 15000);

  it("grant_type desconhecido e pedido incompleto", async () => {
    expect(await pedirToken({ grant_type: "client_credentials" })).toMatchObject({ status: 400, corpo: { error: "unsupported_grant_type" } });
    expect(await pedirToken({ grant_type: "authorization_code", code: "x" })).toMatchObject({ status: 400, corpo: { error: "invalid_request" } });
  });
});

describe("cliente OAuth oficial do SDK do MCP (o mesmo do Claude Code)", () => {
  it("descobre, registra, pede autorização, troca o código e usa o MCP", async () => {
    let cliente: OAuthClientInformationMixed | undefined;
    let tokens: OAuthTokens | undefined;
    let verificador = "";
    let urlDeAutorizacao: URL | undefined;
    const provider: OAuthClientProvider = {
      get redirectUrl() {
        return CALLBACK_LOCAL;
      },
      get clientMetadata() {
        return { client_name: "Claude Code", redirect_uris: [CALLBACK_LOCAL], grant_types: ["authorization_code", "refresh_token"], response_types: ["code"], token_endpoint_auth_method: "none" };
      },
      state: () => "estado-sdk",
      clientInformation: () => cliente,
      saveClientInformation: (c) => void (cliente = c),
      tokens: () => tokens,
      saveTokens: (t) => void (tokens = t),
      redirectToAuthorization: (url) => void (urlDeAutorizacao = url),
      saveCodeVerifier: (v) => void (verificador = v),
      codeVerifier: () => verificador,
    };

    const transporte = () => new StreamableHTTPClientTransport(new URL(`${ORIGEM}/api/mcp`), { authProvider: provider, fetch: fetchDasRotas() });
    const primeiro = new Client({ name: "teste-sdk", version: "1.0.0" });
    const t1 = transporte();
    await expect(primeiro.connect(t1)).rejects.toBeInstanceOf(UnauthorizedError);

    // O "navegador": a URL aberta é a tela de autorização desta plataforma; a pessoa clica em Permitir.
    expect(urlDeAutorizacao).toBeDefined();
    expect(urlDeAutorizacao!.origin + urlDeAutorizacao!.pathname).toBe(`${ORIGEM}/oauth/autorizar`);
    expect(urlDeAutorizacao!.searchParams.get("resource")).toBe(`${ORIGEM}/api/mcp`);
    obterUsuarioLogadoMock.mockResolvedValue(sessaoDe(romulo));
    const campos = Object.fromEntries(urlDeAutorizacao!.searchParams);
    const volta = new URL((await decisao({ ...campos, decisao: "permitir" })).headers.get("location")!);
    expect(volta.searchParams.get("state")).toBe("estado-sdk");
    await t1.finishAuth(volta.searchParams.get("code")!);
    expect(tokens?.access_token).toMatch(/^oem_/);

    const segundo = new Client({ name: "teste-sdk", version: "1.0.0" });
    await segundo.connect(transporte());
    const { tools } = await segundo.listTools();
    expect(tools.map((t) => t.name)).toContain("agenda");
    await segundo.close();

    // Access vencido: o SDK renova sozinho pelo refresh e segue, sem abrir o navegador de novo.
    await prisma.tokenApi.updateMany({ where: { clienteOAuthId: (cliente as { client_id: string }).client_id }, data: { expiraEm: new Date(Date.now() - 1000) } });
    const antes = tokens!.access_token;
    urlDeAutorizacao = undefined;
    const terceiro = new Client({ name: "teste-sdk", version: "1.0.0" });
    await terceiro.connect(transporte());
    expect((await terceiro.listTools()).tools.length).toBeGreaterThan(0);
    expect(tokens!.access_token).not.toBe(antes);
    expect(urlDeAutorizacao).toBeUndefined();
    await terceiro.close();
  }, 30000);
});
