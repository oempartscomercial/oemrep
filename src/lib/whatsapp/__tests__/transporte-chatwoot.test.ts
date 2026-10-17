import { describe, it, expect, vi } from "vitest";
import { ErroDeEnvio } from "../transporte";
import { criarTransporteChatwoot } from "../transporte-chatwoot";

const config = {
  evolution: { url: "https://evo.exemplo.com", apikey: "evo-chave", instancia: "prospeccao" },
  chatwoot: { url: "https://cw.exemplo.com/", conta: "1", token: "cw-token" },
};
const json = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { "content-type": "application/json" } });
const CW = "https://cw.exemplo.com/api/v1/accounts/1";

// Responde por "MÉTODO caminho"; o que não estiver no mapa é erro de teste.
function servidor(rotas: Record<string, (corpo: unknown) => Response>) {
  const chamadas: { rota: string; corpo: unknown; headers: Record<string, string> }[] = [];
  const fetchFn = vi.fn(async (url: string, init: RequestInit = {}) => {
    const rota = `${init.method ?? "GET"} ${url.replace(CW, "CW").replace("https://evo.exemplo.com", "EVO")}`;
    const corpo = init.body ? JSON.parse(String(init.body)) : undefined;
    chamadas.push({ rota, corpo, headers: init.headers as Record<string, string> });
    const r = rotas[rota];
    if (!r) throw new Error(`rota inesperada: ${rota}`);
    return r(corpo);
  });
  return { fetchFn: fetchFn as unknown as typeof fetch, chamadas };
}

const base = {
  "GET EVO/chatwoot/find/prospeccao": () => json({ enabled: true, nameInbox: "WhatsApp Prospecção" }),
  "GET CW/inboxes": () => json({ payload: [{ id: 9, name: "Outra" }, { id: 1, name: "WhatsApp Prospecção" }] }),
};

describe("transporte Chatwoot", () => {
  it("contato com conversa na caixa: posta a mensagem na conversa aberta mais recente", async () => {
    const { fetchFn, chamadas } = servidor({
      ...base,
      "GET CW/contacts/search?q=99998888&include_contacts=true": () =>
        json({ payload: [{ id: 5, phone_number: "+5511999998888" }, { id: 7, phone_number: "+554799998888" }] }),
      "GET CW/contacts/7/conversations": () =>
        json({ payload: [{ id: 30, inbox_id: 1, status: "resolved", last_activity_at: 200 }, { id: 31, inbox_id: 1, status: "open", last_activity_at: 100 }, { id: 32, inbox_id: 9, status: "open", last_activity_at: 300 }] }),
      "POST CW/conversations/31/messages": () => json({ id: 777 }),
    });
    const t = criarTransporteChatwoot(config, fetchFn);
    // Número salvo no Chatwoot sem o 9 do celular: é o mesmo contato.
    expect(await t.enviarTexto("+5547999998888", "Olá")).toEqual({ idExterno: null });
    const envio = chamadas.at(-1)!;
    expect(envio.corpo).toEqual({ content: "Olá", message_type: "outgoing", private: false });
    expect(envio.headers.api_access_token).toBe("cw-token");
  });

  it("contato novo: cria o contato na caixa, abre a conversa e posta", async () => {
    const { fetchFn, chamadas } = servidor({
      ...base,
      "GET CW/contacts/search?q=99998888&include_contacts=true": () => json({ payload: [] }),
      "POST CW/contacts": () => json({ payload: { contact: { id: 40 }, contact_inbox: { source_id: "src-1" } } }),
      "POST CW/conversations": () => json({ id: 50 }),
      "POST CW/conversations/50/messages": () => json({ id: 1 }),
    });
    await criarTransporteChatwoot(config, fetchFn).enviarTexto("+5547999998888", "Olá");
    expect(chamadas.find((c) => c.rota === "POST CW/contacts")!.corpo).toEqual({ inbox_id: 1, name: "+5547999998888", phone_number: "+5547999998888" });
    expect(chamadas.find((c) => c.rota === "POST CW/conversations")!.corpo).toEqual({ source_id: "src-1", inbox_id: 1, contact_id: 40, status: "open" });
  });

  it("contato sem conversa nem vínculo com a caixa: liga à caixa antes de abrir a conversa", async () => {
    const { fetchFn, chamadas } = servidor({
      ...base,
      "GET CW/contacts/search?q=99998888&include_contacts=true": () => json({ payload: [{ id: 7, phone_number: "+5547999998888", contact_inboxes: [] }] }),
      "GET CW/contacts/7/conversations": () => json({ payload: [] }),
      "POST CW/contacts/7/contact_inboxes": () => json({ source_id: "src-2" }),
      "POST CW/conversations": () => json({ id: 51 }),
      "POST CW/conversations/51/messages": () => json({ id: 1 }),
    });
    await criarTransporteChatwoot(config, fetchFn).enviarTexto("+5547999998888", "Olá");
    expect(chamadas.find((c) => c.rota === "POST CW/conversations")!.corpo).toMatchObject({ source_id: "src-2", contact_id: 7 });
  });

  it("falha antes de postar a mensagem: tem certeza de que não enviou", async () => {
    const semCaixa = servidor({ "GET EVO/chatwoot/find/prospeccao": () => json({ enabled: false }) });
    await expect(criarTransporteChatwoot(config, semCaixa.fetchFn).enviarTexto("+5547999998888", "x")).rejects.toMatchObject({ certezaQueNaoEnviou: true });
    const buscaFalha = servidor({ ...base, "GET CW/contacts/search?q=99998888&include_contacts=true": () => json({}, 500) });
    await expect(criarTransporteChatwoot(config, buscaFalha.fetchFn).enviarTexto("+5547999998888", "x")).rejects.toMatchObject({ certezaQueNaoEnviou: true });
  });

  it("falha ao postar: 4xx tem certeza, 5xx ou queda de rede não", async () => {
    const com = (resposta: () => Response) =>
      criarTransporteChatwoot(
        config,
        servidor({
          ...base,
          "GET CW/contacts/search?q=99998888&include_contacts=true": () => json({ payload: [{ id: 7, phone_number: "+5547999998888" }] }),
          "GET CW/contacts/7/conversations": () => json({ payload: [{ id: 31, inbox_id: 1, status: "open" }] }),
          "POST CW/conversations/31/messages": resposta,
        }).fetchFn,
      ).enviarTexto("+5547999998888", "x").catch((e) => e);
    expect(await com(() => json({}, 422))).toMatchObject({ certezaQueNaoEnviou: true });
    const e5 = await com(() => json({}, 502));
    expect(e5).toBeInstanceOf(ErroDeEnvio);
    expect(e5.certezaQueNaoEnviou).toBe(false);
    const rede = await com(() => { throw new Error("timeout"); });
    expect(rede.certezaQueNaoEnviou).toBe(false);
  });

  it("estado da linha vem da Evolution", async () => {
    const { fetchFn } = servidor({ "GET EVO/instance/connectionState/prospeccao": () => json({ instance: { state: "open" } }) });
    expect(await criarTransporteChatwoot(config, fetchFn).estado()).toBe("conectada");
  });
});
