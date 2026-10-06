import { describe, it, expect } from "vitest";
import { casarContato, mesmoTelefone, normalizarTelefone } from "../telefone";

describe("normalizarTelefone", () => {
  it.each([
    ["(47) 99999-8888", "+5547999998888"],
    ["47 99999-8888", "+5547999998888"],
    ["+55 47 99999-8888", "+5547999998888"],
    ["5547999998888", "+5547999998888"],
    ["55 (47) 3333-4444", "+554733334444"],
    ["(47) 3333-4444", "+554733334444"],
    ["5547999998888@s.whatsapp.net", "+5547999998888"],
    ["5547999998888:12@s.whatsapp.net", "+5547999998888"],
    ["  +1 (415) 555-0132 ", "+14155550132"],
  ])("%s → %s", (entrada, esperado) => {
    expect(normalizarTelefone(entrada)).toBe(esperado);
  });

  it.each([
    "",
    "   ",
    "sem número",
    "4799",
    "123456789012345678",
    "120363025246125486@g.us",
    "status@broadcast",
    "99887766554433@lid",
    "(47) 3333-4444 ramal 22",
  ])("não inventa número para %j", (entrada) => {
    expect(normalizarTelefone(entrada)).toBeNull();
  });

  it("sem + e com código que não é 55, não adivinha o país", () => {
    expect(normalizarTelefone("14155550132")).toBeNull();
  });
});

describe("mesmoTelefone — o 9º dígito do celular não separa a mesma pessoa", () => {
  it("celular com e sem o 9 é o mesmo número", () => {
    expect(mesmoTelefone("+5547999998888", "+554799998888")).toBe(true);
  });
  it("DDD diferente não casa", () => {
    expect(mesmoTelefone("+5547999998888", "+5511999998888")).toBe(false);
  });
  it("final diferente não casa", () => {
    expect(mesmoTelefone("+5547999998888", "+5547999998889")).toBe(false);
  });
  it("número de fora do Brasil só casa idêntico", () => {
    expect(mesmoTelefone("+14155550132", "+14155550132")).toBe(true);
    expect(mesmoTelefone("+14155550132", "+14155550133")).toBe(false);
  });
});

describe("casarContato", () => {
  const contatos = [
    { id: "c1", clienteId: "A", valor: "(47) 99999-8888" },
    { id: "c2", clienteId: "A", valor: "47 3333-4444" },
    { id: "c3", clienteId: "B", valor: "+55 11 98888-7777" },
    { id: "c4", clienteId: "B", valor: "contato@empresa.com.br" },
    { id: "c5", clienteId: "C", valor: "(11) 98888-7777" },
  ];

  it("acha o contato único da empresa", () => {
    expect(casarContato("+5547999998888", contatos)).toEqual({ tipo: "unico", contatoId: "c1", clienteId: "A" });
  });

  it("casa mesmo quando o cadastro está sem o 9", () => {
    expect(casarContato("+554733334444", contatos)).toEqual({ tipo: "unico", contatoId: "c2", clienteId: "A" });
  });

  it("número em duas empresas não é adivinhado", () => {
    expect(casarContato("+5511988887777", contatos)).toEqual({ tipo: "varias_empresas", clienteIds: ["B", "C"] });
  });

  it("dois contatos da mesma empresa com o mesmo número: fica a empresa, o primeiro contato", () => {
    const r = casarContato("+5547999998888", [
      { id: "x1", clienteId: "A", valor: "47 99999-8888" },
      { id: "x2", clienteId: "A", valor: "(47) 99999-8888" },
    ]);
    expect(r).toEqual({ tipo: "unico", contatoId: "x1", clienteId: "A" });
  });

  it("número desconhecido e valor que não é telefone não casam", () => {
    expect(casarContato("+5599911112222", contatos)).toEqual({ tipo: "nenhum" });
  });
});
