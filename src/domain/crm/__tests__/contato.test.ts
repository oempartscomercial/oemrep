import { describe, it, expect } from "vitest";
import { chaveDuplicidade, validarContato } from "../contato";

const base = { canal: "WHATSAPP", valor: "(47) 99999-8888", fonte: "Publicado no site" };

describe("validarContato", () => {
  it("aceita um WhatsApp válido e devolve o número formatado para leitura", () => {
    expect(validarContato(base)).toEqual({ erros: [], valorNormalizado: "(47) 99999-8888" });
  });

  it("formata o telefone digitado sem máscara e com +55", () => {
    expect(validarContato({ ...base, valor: "47999998888" }).valorNormalizado).toBe("(47) 99999-8888");
    expect(validarContato({ ...base, valor: "+55 47 99999-8888" }).valorNormalizado).toBe("(47) 99999-8888");
  });

  it("telefone fixo vale para a ligação", () => {
    expect(validarContato({ canal: "TELEFONE", valor: "+55 47 3333-4444", fonte: "Lista" })).toEqual({
      erros: [],
      valorNormalizado: "(47) 3333-4444",
    });
  });

  it("número sem DDD é recusado; nunca se completa dígito", () => {
    expect(validarContato({ ...base, valor: "99999-8888" }).erros).toEqual(["Telefone inválido. Use DDD + número."]);
  });

  it("número de fora do Brasil com + passa no formato internacional", () => {
    expect(validarContato({ canal: "WHATSAPP", valor: "+1 415 555 2671", fonte: "Indicação" }).valorNormalizado).toBe("+14155552671");
  });

  it("e-mail válido passa; e-mail sem domínio completo é recusado", () => {
    expect(validarContato({ canal: "EMAIL", valor: " ana@empresa.com.br ", fonte: "Site" })).toEqual({
      erros: [],
      valorNormalizado: "ana@empresa.com.br",
    });
    expect(validarContato({ canal: "EMAIL", valor: "ana@empresa", fonte: "Site" }).erros).toEqual([
      "E-mail inválido. Ex.: nome@empresa.com.br",
    ]);
  });

  it("LinkedIn e Outro aceitam texto livre (só exigem o valor)", () => {
    expect(validarContato({ canal: "LINKEDIN", valor: "linkedin.com/in/ana", fonte: "Busca" }).erros).toEqual([]);
    expect(validarContato({ canal: "OUTRO", valor: "Balcão da loja", fonte: "Visita" }).erros).toEqual([]);
  });

  it("canal é obrigatório e precisa ser um dos valores do cadastro", () => {
    expect(validarContato({ ...base, canal: "" }).erros).toEqual(["Escolha por onde é esse contato."]);
    expect(validarContato({ ...base, canal: "FAX" }).erros).toEqual(["Escolha por onde é esse contato."]);
  });

  it("valor é obrigatório", () => {
    expect(validarContato({ ...base, valor: "   " }).erros).toEqual(["Informe o número ou o e-mail deste contato."]);
  });

  it("fonte é obrigatória (texto livre)", () => {
    expect(validarContato({ ...base, fonte: "  " }).erros).toEqual([
      "Diga de onde veio esse contato (ex.: Indicação do João).",
    ]);
  });

  it("junta todos os erros de uma vez", () => {
    expect(validarContato({ canal: "EMAIL", valor: "", fonte: "" }).erros).toEqual([
      "Informe o número ou o e-mail deste contato.",
      "Diga de onde veio esse contato (ex.: Indicação do João).",
    ]);
  });
});

describe("chaveDuplicidade", () => {
  it("o mesmo telefone em formatos diferentes tem a mesma chave", () => {
    expect(chaveDuplicidade("WHATSAPP", "(47) 99999-8888")).toBe(chaveDuplicidade("WHATSAPP", "+5547999998888"));
    expect(chaveDuplicidade("TELEFONE", "47 99999 8888")).toBe(chaveDuplicidade("TELEFONE", "(47) 99999-8888"));
  });

  it("telefones diferentes têm chaves diferentes", () => {
    expect(chaveDuplicidade("WHATSAPP", "(47) 99999-8888")).not.toBe(chaveDuplicidade("WHATSAPP", "(47) 99999-8889"));
  });

  it("e-mail não diferencia maiúscula de minúscula", () => {
    expect(chaveDuplicidade("EMAIL", "Ana@Empresa.com.br")).toBe(chaveDuplicidade("EMAIL", " ana@empresa.com.br"));
  });
});
