import { describe, it, expect } from "vitest";
import { validarChatwoot, validarEvolution } from "../validacao";

describe("validação da tela Integrações", () => {
  it("Evolution: endereço http(s), instância simples e chave obrigatória só na primeira vez", () => {
    expect(validarEvolution({ url: "https://evo.exemplo.com/", instancia: "prospeccao", apikey: "k" }, false)).toEqual({
      erros: [],
      valores: { url: "https://evo.exemplo.com", instancia: "prospeccao", apikey: "k" },
    });
    expect(validarEvolution({ url: "evo.exemplo.com", instancia: "", apikey: "" }, false).erros).toEqual([
      "Informe o endereço da Evolution começando com https://.",
      "Informe o nome da instância (letras, números, - ou _).",
      "Informe a chave (API key) da Evolution.",
    ]);
    // Campo da chave vazio ao editar = manter a salva.
    expect(validarEvolution({ url: "https://e.com", instancia: "prospeccao", apikey: "  " }, true)).toEqual({
      erros: [],
      valores: { url: "https://e.com", instancia: "prospeccao", apikey: null },
    });
    expect(validarEvolution({ url: "https://e.com", instancia: "pros peccao", apikey: "k" }, false).erros).toHaveLength(1);
  });

  it("Chatwoot: endereço, número da conta e token", () => {
    expect(validarChatwoot({ url: "https://chat.exemplo.com", conta: " 1 ", token: "tok" }, false)).toEqual({
      erros: [],
      valores: { url: "https://chat.exemplo.com", conta: "1", token: "tok" },
    });
    expect(validarChatwoot({ url: "ftp://x", conta: "um", token: "" }, false).erros).toEqual([
      "Informe o endereço do Chatwoot começando com https://.",
      "O número da conta do Chatwoot é só número (ex.: 1).",
      "Informe o token de acesso do Chatwoot.",
    ]);
    expect(validarChatwoot({ url: "https://c.com", conta: "2", token: "" }, true).valores?.token).toBeNull();
  });
});
