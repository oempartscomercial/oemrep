import { describe, it, expect } from "vitest";
import { randomBytes } from "node:crypto";
import { cifrar, decifrar, lerChave, ErroDeCifra } from "../cifra";

const chaveHex = randomBytes(32).toString("hex");
const chaveB64 = randomBytes(32).toString("base64");

describe("cifra dos segredos de integração (AES-256-GCM)", () => {
  it("lê a chave em hex (64 caracteres) ou base64 (32 bytes); o resto não vale", () => {
    expect(lerChave({ INTEGRACOES_CHAVE: chaveHex })?.length).toBe(32);
    expect(lerChave({ INTEGRACOES_CHAVE: chaveB64 })?.length).toBe(32);
    expect(lerChave({})).toBeNull();
    expect(lerChave({ INTEGRACOES_CHAVE: "" })).toBeNull();
    expect(lerChave({ INTEGRACOES_CHAVE: "curta-demais" })).toBeNull();
    expect(lerChave({ INTEGRACOES_CHAVE: randomBytes(16).toString("base64") })).toBeNull();
  });

  it("cifra e decifra; o texto cifrado não contém o segredo e muda a cada vez", () => {
    const chave = lerChave({ INTEGRACOES_CHAVE: chaveHex })!;
    const a = cifrar("minha-api-key-1a2b", chave);
    const b = cifrar("minha-api-key-1a2b", chave);
    expect(a).not.toContain("minha-api-key");
    expect(a).toMatch(/^v1:/);
    expect(a).not.toBe(b);
    expect(decifrar(a, chave)).toBe("minha-api-key-1a2b");
    expect(decifrar(b, chave)).toBe("minha-api-key-1a2b");
  });

  it("chave errada ou texto adulterado: erro, nunca lixo", () => {
    const chave = lerChave({ INTEGRACOES_CHAVE: chaveHex })!;
    const outra = lerChave({ INTEGRACOES_CHAVE: chaveB64 })!;
    const c = cifrar("segredo", chave);
    expect(() => decifrar(c, outra)).toThrow(ErroDeCifra);
    const partes = c.split(":");
    partes[3] = Buffer.from("adulterado").toString("base64");
    expect(() => decifrar(partes.join(":"), chave)).toThrow(ErroDeCifra);
    expect(() => decifrar("lixo", chave)).toThrow(ErroDeCifra);
  });
});
