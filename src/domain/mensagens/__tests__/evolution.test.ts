import { describe, it, expect } from "vitest";
import { lerEventoEvolution } from "../evolution";

// Formato do `messages.upsert` da Evolution API v2. Ainda não foi conferido contra a
// instância real do Rômulo (ADR-015, fase 1): o evento bruto é guardado antes de ser lido.
function upsert(data: Record<string, unknown>, evento = "messages.upsert") {
  return { event: evento, instance: "oem", data };
}
const chave = (extra: Record<string, unknown> = {}) => ({
  remoteJid: "5547999998888@s.whatsapp.net",
  fromMe: false,
  id: "3EB0AAAA",
  ...extra,
});

describe("lerEventoEvolution — mensagens", () => {
  it("texto recebido vira mensagem de ENTRADA do contato", () => {
    const [e] = lerEventoEvolution(
      upsert({ key: chave(), pushName: "Ana", message: { conversation: "Bom dia, pode mandar o catálogo" }, messageTimestamp: 1_791_300_000 }),
    );
    expect(e).toEqual({
      tipo: "mensagem",
      idExterno: "3EB0AAAA",
      numero: "+5547999998888",
      direcao: "ENTRADA",
      origem: "CONTATO",
      tipoMensagem: "TEXTO",
      texto: "Bom dia, pode mandar o catálogo",
      ocorridoEm: new Date(1_791_300_000 * 1000),
      nomeNoWhatsapp: "Ana",
    });
  });

  it("texto longo (extendedTextMessage) e mensagem enviada pelo celular do Rômulo", () => {
    const [e] = lerEventoEvolution(
      upsert({ key: chave({ fromMe: true, id: "3EB0BBBB" }), message: { extendedTextMessage: { text: "Segue o link" } }, messageTimestamp: 1_791_300_100 }),
    );
    expect(e).toMatchObject({ tipo: "mensagem", direcao: "SAIDA", origem: "ROMULO_NO_CELULAR", tipoMensagem: "TEXTO", texto: "Segue o link", nomeNoWhatsapp: null });
  });

  it("o nome do WhatsApp de uma mensagem enviada não é do contato", () => {
    const [e] = lerEventoEvolution(
      upsert({ key: chave({ fromMe: true }), pushName: "Rômulo", message: { conversation: "oi" }, messageTimestamp: 1 }),
    );
    expect(e).toMatchObject({ tipo: "mensagem", nomeNoWhatsapp: null });
  });

  it("áudio fica sem texto (a transcrição é de outra fase)", () => {
    const [e] = lerEventoEvolution(upsert({ key: chave(), message: { audioMessage: { seconds: 12 } }, messageTimestamp: 2 }));
    expect(e).toMatchObject({ tipo: "mensagem", tipoMensagem: "AUDIO", texto: null });
  });

  it("imagem e documento guardam a legenda", () => {
    const [img] = lerEventoEvolution(upsert({ key: chave({ id: "I1" }), message: { imageMessage: { caption: "Foto da peça" } }, messageTimestamp: 3 }));
    const [doc] = lerEventoEvolution(upsert({ key: chave({ id: "D1" }), message: { documentMessage: { caption: "Pedido", fileName: "pedido.pdf" } }, messageTimestamp: 4 }));
    expect(img).toMatchObject({ tipoMensagem: "IMAGEM", texto: "Foto da peça" });
    expect(doc).toMatchObject({ tipoMensagem: "DOCUMENTO", texto: "Pedido" });
  });

  it("documento sem legenda usa o nome do arquivo", () => {
    const [doc] = lerEventoEvolution(upsert({ key: chave({ id: "D2" }), message: { documentMessage: { fileName: "tabela.xlsx" } }, messageTimestamp: 5 }));
    expect(doc).toMatchObject({ tipoMensagem: "DOCUMENTO", texto: "tabela.xlsx" });
  });

  it("tipo que não conhecemos é registrado como OUTRO, não some", () => {
    const [e] = lerEventoEvolution(upsert({ key: chave(), message: { stickerMessage: {} }, messageTimestamp: 6 }));
    expect(e).toMatchObject({ tipo: "mensagem", tipoMensagem: "OUTRO", texto: null });
  });

  it("desembrulha mensagem temporária", () => {
    const [e] = lerEventoEvolution(
      upsert({ key: chave(), message: { ephemeralMessage: { message: { conversation: "texto embrulhado" } } }, messageTimestamp: 7 }),
    );
    expect(e).toMatchObject({ tipo: "mensagem", tipoMensagem: "TEXTO", texto: "texto embrulhado" });
  });

  it("aceita o horário como texto ou como número de 64 bits", () => {
    const [a] = lerEventoEvolution(upsert({ key: chave({ id: "T1" }), message: { conversation: "a" }, messageTimestamp: "1791300000" }));
    const [b] = lerEventoEvolution(upsert({ key: chave({ id: "T2" }), message: { conversation: "b" }, messageTimestamp: { low: 1_791_300_000, high: 0 } }));
    expect(a).toMatchObject({ ocorridoEm: new Date(1_791_300_000_000) });
    expect(b).toMatchObject({ ocorridoEm: new Date(1_791_300_000_000) });
  });

  it("sem horário, não inventa: ocorridoEm vem nulo", () => {
    const [e] = lerEventoEvolution(upsert({ key: chave(), message: { conversation: "sem hora" } }));
    expect(e).toMatchObject({ tipo: "mensagem", ocorridoEm: null });
  });

  it("nome do evento em outro formato (MESSAGES_UPSERT) também vale", () => {
    const [e] = lerEventoEvolution(upsert({ key: chave(), message: { conversation: "oi" }, messageTimestamp: 8 }, "MESSAGES_UPSERT"));
    expect(e.tipo).toBe("mensagem");
  });
});

describe("lerEventoEvolution — o que não é conversa individual", () => {
  it("grupo, status e lista de transmissão são ignorados", () => {
    for (const remoteJid of ["120363025246125486@g.us", "status@broadcast", "1791300000@broadcast"]) {
      const [e] = lerEventoEvolution(upsert({ key: chave({ remoteJid }), message: { conversation: "x" }, messageTimestamp: 9 }));
      expect(e.tipo).toBe("ignorado");
    }
  });

  it("reação e mensagem de protocolo (apagar/editar) não são mensagens", () => {
    const [r] = lerEventoEvolution(upsert({ key: chave({ id: "R1" }), message: { reactionMessage: { text: "👍" } }, messageTimestamp: 10 }));
    const [p] = lerEventoEvolution(upsert({ key: chave({ id: "P1" }), message: { protocolMessage: { type: 0 } }, messageTimestamp: 11 }));
    expect(r.tipo).toBe("ignorado");
    expect(p.tipo).toBe("ignorado");
  });

  it("contato identificado só por lid não tem telefone: vira sem_numero, não é descartado", () => {
    const [e] = lerEventoEvolution(upsert({ key: chave({ remoteJid: "99887766554433@lid" }), message: { conversation: "oi" }, messageTimestamp: 12 }));
    expect(e).toMatchObject({ tipo: "sem_numero", jid: "99887766554433@lid", idExterno: "3EB0AAAA" });
  });

  it("outros eventos (conexão, recibo de leitura) são ignorados", () => {
    expect(lerEventoEvolution(upsert({ state: "open" }, "connection.update"))[0].tipo).toBe("ignorado");
    expect(lerEventoEvolution(upsert({ key: chave(), status: "READ" }, "messages.update"))[0].tipo).toBe("ignorado");
  });

  it("corpo que não parece evento é ignorado com motivo", () => {
    for (const lixo of [null, "texto", 42, [], {}, { event: "messages.upsert" }, { event: "messages.upsert", data: { key: {} } }]) {
      const [e] = lerEventoEvolution(lixo);
      expect(e.tipo).toBe("ignorado");
    }
  });

  it("mensagem sem id externo não é aceita (não dá para evitar duplicata)", () => {
    const [e] = lerEventoEvolution(upsert({ key: { remoteJid: "5547999998888@s.whatsapp.net", fromMe: false }, message: { conversation: "oi" }, messageTimestamp: 13 }));
    expect(e.tipo).toBe("ignorado");
  });
});
