import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { extrairBearer, gerarToken, hashDoToken, pareceToken, prefixoDoToken } from "../token";

describe("token de acesso do Claude", () => {
  it("gera um segredo novo a cada vez, com o prefixo oem_ e sem caracteres que quebram URL", () => {
    const a = gerarToken();
    const b = gerarToken();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^oem_[A-Za-z0-9_-]{43}$/);
    expect(pareceToken(a)).toBe(true);
  });

  it("guarda só o hash SHA-256 em hexadecimal", () => {
    const token = gerarToken();
    expect(hashDoToken(token)).toBe(createHash("sha256").update(token).digest("hex"));
    expect(hashDoToken(token)).not.toContain(token.slice(4, 20));
  });

  it("mostra só o começo do token, para reconhecer na lista", () => {
    expect(prefixoDoToken("oem_abcdefghijklmnopqrstuvwxyz")).toBe("oem_abcdef");
  });

  it("reconhece o formato e recusa lixo antes de ir ao banco", () => {
    expect(pareceToken("")).toBe(false);
    expect(pareceToken("oem_curto")).toBe(false);
    expect(pareceToken("xyz_" + "a".repeat(43))).toBe(false);
    expect(pareceToken("oem_" + "a".repeat(42) + "!")).toBe(false);
  });

  it("lê o cabeçalho Authorization: Bearer", () => {
    expect(extrairBearer("Bearer oem_abc")).toBe("oem_abc");
    expect(extrairBearer("bearer   oem_abc  ")).toBe("oem_abc");
    expect(extrairBearer("Basic dXNlcjpzZW5oYQ==")).toBeNull();
    expect(extrairBearer("Bearer ")).toBeNull();
    expect(extrairBearer(null)).toBeNull();
  });
});
