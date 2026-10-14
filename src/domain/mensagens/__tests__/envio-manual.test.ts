import { describe, it, expect } from "vitest";
import { bloqueiosDoEnvioManual, envioPeloCelularDaConversa, linkDoWhatsapp, prepararEnvioPeloCelular } from "../envio-manual";

const sp = (iso: string) => new Date(`${iso}-03:00`);
const SABADO_23H = sp("2026-10-10T23:00:00");

describe("linkDoWhatsapp — abre a conversa no WhatsApp com o texto pronto", () => {
  it("usa só os dígitos, com o 55, tenha o número '+55' ou não", () => {
    const esperado = "https://wa.me/5547999998888?text=Ol%C3%A1";
    expect(linkDoWhatsapp("+5547999998888", "Olá")).toBe(esperado);
    expect(linkDoWhatsapp("5547999998888", "Olá")).toBe(esperado);
    expect(linkDoWhatsapp("47999998888", "Olá")).toBe(esperado);
    expect(linkDoWhatsapp("(47) 9 9999-8888", "Olá")).toBe(esperado);
  });

  it("codifica acentos, espaços, quebras de linha e símbolos do texto", () => {
    const link = linkDoWhatsapp("+5547999998888", "Olá, tudo bem?\nSou o Rômulo & cia: 100% peças.");
    expect(link).toBe("https://wa.me/5547999998888?text=Ol%C3%A1%2C%20tudo%20bem%3F%0ASou%20o%20R%C3%B4mulo%20%26%20cia%3A%20100%25%20pe%C3%A7as.");
    expect(new URL(link!).searchParams.get("text")).toBe("Olá, tudo bem?\nSou o Rômulo & cia: 100% peças.");
  });

  it("número estrangeiro com '+' fica como está; o que não é telefone não vira link", () => {
    expect(linkDoWhatsapp("+14155550100", "Hi")).toBe("https://wa.me/14155550100?text=Hi");
    expect(linkDoWhatsapp("contato@empresa.com.br", "Olá")).toBeNull();
    expect(linkDoWhatsapp("123", "Olá")).toBeNull();
  });
});

const base = {
  agora: SABADO_23H,
  tipo: "PRIMEIRO_CONTATO" as const,
  texto: "Olá, tudo bem? Quem cuida da compra dessa linha aí?",
  empresa: { situacao: "APROVADA", naoContatar: false },
  contato: { naoContatar: false, origemContato: "PUBLICADO_PELA_EMPRESA" },
  numero: "+5547999998888",
  historico: [],
  limites: { horarioInicio: 8, horarioFim: 18, maxPrimeirosPorDia: 15, diasEntreMensagens: 3, maxTentativas: 3 },
};

describe("bloqueiosDoEnvioManual — só as proteções que valem quando a pessoa envia", () => {
  it("horário, linha e limite do dia não seguram o envio pelo celular", () => {
    expect(bloqueiosDoEnvioManual(base)).toEqual([]);
  });

  it("não contatar, empresa descartada e contato sem origem continuam bloqueando", () => {
    expect(bloqueiosDoEnvioManual({ ...base, contato: { naoContatar: true, origemContato: "INDICACAO" } }).map((b) => b.codigo)).toEqual(["nao_contatar"]);
    expect(bloqueiosDoEnvioManual({ ...base, empresa: { situacao: "DESCARTADA", naoContatar: false } }).map((b) => b.codigo)).toEqual(["empresa_descartada"]);
    expect(bloqueiosDoEnvioManual({ ...base, contato: { naoContatar: false, origemContato: null } }).map((b) => b.codigo)).toEqual(["sem_origem"]);
  });
});

describe("prepararEnvioPeloCelular — o que a tela mostra para uma aprovada", () => {
  it("sem bloqueio: o link", () => {
    expect(prepararEnvioPeloCelular(base)).toEqual({ link: linkDoWhatsapp(base.numero, base.texto), bloqueio: null });
  });

  it("com bloqueio: nada de link, e o motivo em palavras simples", () => {
    expect(prepararEnvioPeloCelular({ ...base, empresa: { situacao: "APROVADA", naoContatar: true } })).toEqual({
      link: null,
      bloqueio: "Esta empresa ou este contato pediu para não ser contatado.",
    });
  });
});

describe("envioPeloCelularDaConversa — prepara cada aprovada da conversa", () => {
  const aprovada = { id: "m2", direcao: "SAIDA" as const, status: "APROVADA", tipoEnvio: "PRIMEIRO_CONTATO" as const, texto: base.texto, ocorridoEm: SABADO_23H };
  const conversa = {
    numero: base.numero,
    empresa: base.empresa,
    contato: base.contato,
    mensagens: [{ id: "m1", direcao: "SAIDA" as const, status: "CANCELADA", tipoEnvio: "PRIMEIRO_CONTATO" as const, texto: "antiga", ocorridoEm: SABADO_23H }, aprovada],
  };

  it("só as aprovadas ganham link; a própria mensagem não conta como histórico", () => {
    expect(envioPeloCelularDaConversa(conversa, base.limites, SABADO_23H)).toEqual({ m2: { link: linkDoWhatsapp(base.numero, base.texto), bloqueio: null } });
  });

  it("conversa sem contato cadastrado não oferece link", () => {
    expect(envioPeloCelularDaConversa({ ...conversa, contato: null }, base.limites, SABADO_23H)).toEqual({
      m2: { link: null, bloqueio: "A mensagem não está ligada a um contato cadastrado." },
    });
  });
});
