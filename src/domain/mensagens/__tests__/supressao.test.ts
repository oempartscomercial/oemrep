import { describe, it, expect } from "vitest";
import { classificarPorRegra } from "../supressao";

const nivel = (t: string | null) => classificarPorRegra(t);

describe("classificarPorRegra — pedido de parar vale na hora (ADR-015 §5)", () => {
  it.each([
    "Parar",
    "PARE!",
    "pare por favor",
    "sair",
    "Sair da lista",
    "remover",
    "Remova meu número",
    "stop",
    "descadastrar",
    "Não quero mais receber mensagens",
    "não quero mais",
    "Não me envie mais nada",
    "nao me mande mensagem",
    "Pare de me mandar mensagem",
    "para de me escrever, por favor",
    "Por favor me remova da lista",
    "tire meu número da lista de vocês",
    "Não entrem mais em contato",
    "não envie mais",
    "Isso é spam",
    "Quero ser descadastrado",
  ])("%j → NAO_CONTATAR", (texto) => {
    expect(nivel(texto)).toBe("NAO_CONTATAR");
  });

  it.each([
    "Não tenho interesse",
    "Sem interesse, obrigado",
    "não quero",
    "Não quero, obrigada",
    "Não me interessa",
    "não precisamos disso",
    "Olá, no momento não temos interesse nessa linha, mas obrigado pelo contato",
  ])("%j → NAO_INTERESSADO (não suprime sozinho)", (texto) => {
    expect(nivel(texto)).toBe("NAO_INTERESSADO");
  });

  it.each([
    "Bom dia, pode mandar o catálogo?",
    "Quem fala? Vi o anúncio de vocês",
    "Não quero esse modelo, quero o de 12 estrias para o trator da Valtra",
    "Vou sair para o almoço, já volto",
    "Pode parar na loja amanhã que eu atendo",
    "Cancelar o pedido 123",
    "Qual o prazo? Preciso para segunda",
    "",
    "   ",
  ])("%j → sem classificação automática", (texto) => {
    expect(nivel(texto)).toBeNull();
  });

  it("texto nulo (áudio, imagem sem legenda) não classifica", () => {
    expect(nivel(null)).toBeNull();
  });

  it("ignora acento, caixa e pontuação", () => {
    expect(nivel("NÃO!!! ME!!! ENVIE!!! MAIS!!!")).toBe("NAO_CONTATAR");
  });
});
