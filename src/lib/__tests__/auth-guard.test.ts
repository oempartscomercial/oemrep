import { describe, it, expect } from "vitest";
import { rotaProtegida, loginDispensado, caminhoDoLogin } from "../auth-guard";

describe("proteção de rotas", () => {
  it("não protege /login", () => {
    expect(rotaProtegida("/login")).toBe(false);
  });
  it("não protege /auth/confirm (entrada dos links de convite e recuperação)", () => {
    expect(rotaProtegida("/auth/confirm")).toBe(false);
    expect(rotaProtegida("/autorizacao")).toBe(true);
  });
  it("não protege o webhook do WhatsApp (quem o protege é o segredo, não a sessão)", () => {
    expect(rotaProtegida("/api/whatsapp/prospeccao/webhook")).toBe(false);
  });
  it("não protege o cron de envio do WhatsApp (quem o protege é o CRON_SECRET, não a sessão)", () => {
    expect(rotaProtegida("/api/cron/whatsapp")).toBe(false);
    expect(rotaProtegida("/api/cronista")).toBe(true);
  });
  it("não protege o servidor MCP do Claude (quem o protege é o token, não a sessão)", () => {
    expect(rotaProtegida("/api/mcp")).toBe(false);
    expect(rotaProtegida("/api/mcp/oem_abc")).toBe(false);
    expect(rotaProtegida("/api/mcpx")).toBe(true);
  });
  it("não protege o OAuth do Claude (metadados, registro, token, revogação), mas a tela de Permitir exige login", () => {
    expect(rotaProtegida("/.well-known/oauth-protected-resource")).toBe(false);
    expect(rotaProtegida("/.well-known/oauth-protected-resource/api/mcp")).toBe(false);
    expect(rotaProtegida("/.well-known/oauth-authorization-server")).toBe(false);
    expect(rotaProtegida("/oauth/register")).toBe(false);
    expect(rotaProtegida("/oauth/token")).toBe(false);
    expect(rotaProtegida("/oauth/revogar")).toBe(false);
    expect(rotaProtegida("/authorize")).toBe(false);
    expect(rotaProtegida("/oauth/autorizar")).toBe(true);
    expect(rotaProtegida("/oauth/autorizar/decisao")).toBe(true);
    expect(rotaProtegida("/oauth/tokenx")).toBe(true);
  });
  it("o resto de /api continua protegido", () => {
    expect(rotaProtegida("/api/clientes")).toBe(true);
    expect(rotaProtegida("/api/whatsapp-outra-coisa")).toBe(true);
  });
  it("protege /pedidos", () => {
    expect(rotaProtegida("/pedidos")).toBe(true);
  });
});

describe("ida para o login", () => {
  it("guarda o caminho de volta em proximo (GET), inclusive a query inteira", () => {
    expect(caminhoDoLogin("/oauth/autorizar", "?client_id=c1&state=a%26b", "GET")).toBe("/login?proximo=%2Foauth%2Fautorizar%3Fclient_id%3Dc1%26state%3Da%2526b");
    expect(caminhoDoLogin("/pedidos", "", "GET")).toBe("/login?proximo=%2Fpedidos");
  });
  it("da raiz, de uma API ou de um POST, vai para o login puro", () => {
    expect(caminhoDoLogin("/", "", "GET")).toBe("/login");
    expect(caminhoDoLogin("/api/export/pedidos", "?x=1", "GET")).toBe("/login");
    expect(caminhoDoLogin("/oauth/autorizar/decisao", "", "POST")).toBe("/login");
  });
});

describe("login dispensado (SKIP_AUTH)", () => {
  it("só vale fora de produção", () => {
    expect(loginDispensado({ SKIP_AUTH: "true", NODE_ENV: "development" })).toBe(true);
    expect(loginDispensado({ SKIP_AUTH: "true", NODE_ENV: "production" })).toBe(false);
    expect(loginDispensado({ SKIP_AUTH: "false", NODE_ENV: "development" })).toBe(false);
    expect(loginDispensado({ NODE_ENV: "development" })).toBe(false);
  });
});
