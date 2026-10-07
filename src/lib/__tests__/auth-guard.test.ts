import { describe, it, expect } from "vitest";
import { rotaProtegida, loginDispensado } from "../auth-guard";

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
  it("o resto de /api continua protegido", () => {
    expect(rotaProtegida("/api/clientes")).toBe(true);
    expect(rotaProtegida("/api/whatsapp-outra-coisa")).toBe(true);
  });
  it("protege /pedidos", () => {
    expect(rotaProtegida("/pedidos")).toBe(true);
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
