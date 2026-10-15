import { describe, it, expect } from "vitest";
import { linkDoSite, validarCadastroEmpresa } from "../cadastro";

const base = { nome: "Real Trator", cnpj: "", uf: "", cidade: "", site: "", grupo: "", origem: "", observacoes: "", fabricasIds: [] as string[] };

describe("validarCadastroEmpresa", () => {
  it("normaliza e limpa os campos de uma empresa em prospecção", () => {
    const r = validarCadastroEmpresa({ ...base, nome: "  Real Trator ", cnpj: "11.444.777/0001-61", uf: "pe", cidade: " Recife ", site: " realtrator.com.br " }, "CANDIDATA");
    expect(r.erros).toEqual([]);
    expect(r.dados).toEqual({
      nomeFantasia: "Real Trator",
      cnpj: "11444777000161",
      uf: "PE",
      cidade: "Recife",
      site: "realtrator.com.br",
      grupo: null,
      origem: null,
      observacoes: null,
    });
  });

  it("recusa nome vazio, CNPJ inválido e UF desconhecida", () => {
    const r = validarCadastroEmpresa({ ...base, nome: " ", cnpj: "123", uf: "XX" }, "CANDIDATA");
    expect(r.erros).toEqual(["Informe o nome da empresa.", "CNPJ inválido.", "UF inválida. Use a sigla do estado (ex.: PE)."]);
  });

  it("cliente precisa de ao menos uma fábrica; prospecção não", () => {
    expect(validarCadastroEmpresa(base, "CLIENTE").erros).toEqual(["Cliente precisa de ao menos uma fábrica."]);
    expect(validarCadastroEmpresa({ ...base, fabricasIds: ["f1"] }, "CLIENTE").erros).toEqual([]);
    expect(validarCadastroEmpresa(base, "EM_CONTATO").erros).toEqual([]);
  });
});

describe("linkDoSite", () => {
  it("completa o protocolo e recusa o que não parece endereço", () => {
    expect(linkDoSite("ditrac.com.br")).toBe("https://ditrac.com.br");
    expect(linkDoSite("http://x.com.br/a")).toBe("http://x.com.br/a");
    expect(linkDoSite("não tem")).toBeNull();
    expect(linkDoSite(null)).toBeNull();
  });
});
