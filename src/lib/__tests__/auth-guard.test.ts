import { describe, it, expect } from "vitest";
import { rotaProtegida, loginDispensado } from "../auth-guard";

describe("proteção de rotas", () => {
  it("não protege /login", () => {
    expect(rotaProtegida("/login")).toBe(false);
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
