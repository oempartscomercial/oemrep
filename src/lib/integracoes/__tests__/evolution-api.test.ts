import { describe, it, expect, vi } from "vitest";
import { clienteEvolution, EVENTOS_DO_WEBHOOK } from "../evolution-api";

// Servidor falso: nenhuma chamada sai para a Evolution de verdade.
const cfg = { url: "https://evo.exemplo.com", apikey: "chave-1a2b", instancia: "prospeccao" };
const json = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { "content-type": "application/json" } });

function servidor(rotas: Record<string, (init?: RequestInit) => Response>) {
  return vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const u = new URL(String(url));
    const chave = `${init?.method ?? "GET"} ${u.pathname}`;
    const rota = rotas[chave];
    if (!rota) return json({ message: "não achei" }, 404);
    return rota(init);
  });
}

const instancias = (extra: Record<string, unknown> = {}) => [
  { name: "outra", connectionStatus: "open" },
  { name: "prospeccao", connectionStatus: "open", ownerJid: "5598991234567@s.whatsapp.net", profileName: "OEM Prospecção", ...extra },
];

describe("cliente da Evolution (tela Integrações)", () => {
  it("testar: chave aceita e instância encontrada, com a chave no cabeçalho apikey", async () => {
    const f = servidor({ "GET /instance/fetchInstances": () => json(instancias()) });
    const r = await clienteEvolution(cfg, f as unknown as typeof fetch).testar();
    expect(r).toEqual({ ok: true, instanciaExiste: true });
    expect((f.mock.calls[0][1]!.headers as Record<string, string>).apikey).toBe("chave-1a2b");
  });

  it("testar: chave recusada, endereço errado ou fora do ar viram frases simples", async () => {
    const recusa = servidor({ "GET /instance/fetchInstances": () => json({ message: "Unauthorized" }, 401) });
    expect(await clienteEvolution(cfg, recusa as unknown as typeof fetch).testar()).toEqual({ ok: false, erro: "A Evolution recusou a chave (API key). Confira e salve de novo." });
    const naoEhEvolution = servidor({});
    expect((await clienteEvolution(cfg, naoEhEvolution as unknown as typeof fetch).testar()).ok).toBe(false);
    const foraDoAr = vi.fn(async () => { throw new Error("ECONNREFUSED"); });
    expect(await clienteEvolution(cfg, foraDoAr as unknown as typeof fetch).testar()).toEqual({ ok: false, erro: "Não consegui falar com a Evolution nesse endereço." });
  });

  it("estado: conectado com o número; desconectado; instância que não existe", async () => {
    const conectado = servidor({ "GET /instance/fetchInstances": () => json(instancias()) });
    expect(await clienteEvolution(cfg, conectado as unknown as typeof fetch).estado()).toEqual({ existe: true, estado: "conectada", numero: "+5598991234567", nomePerfil: "OEM Prospecção" });
    const fechado = servidor({ "GET /instance/fetchInstances": () => json(instancias({ connectionStatus: "close", ownerJid: null })) });
    expect(await clienteEvolution(cfg, fechado as unknown as typeof fetch).estado()).toMatchObject({ existe: true, estado: "desconectada", numero: null });
    const semInstancia = servidor({ "GET /instance/fetchInstances": () => json([{ name: "outra" }]) });
    expect(await clienteEvolution(cfg, semInstancia as unknown as typeof fetch).estado()).toMatchObject({ existe: false, estado: "desconhecida" });
    // Formato da v1: { instance: { instanceName, status } }.
    const v1 = servidor({ "GET /instance/fetchInstances": () => json([{ instance: { instanceName: "prospeccao", status: "connecting" } }]) });
    expect(await clienteEvolution(cfg, v1 as unknown as typeof fetch).estado()).toMatchObject({ existe: true, estado: "conectando" });
  });

  it("QR Code: devolve a imagem; se já conectou, diz que está conectado", async () => {
    const comQr = servidor({ "GET /instance/connect/prospeccao": () => json({ base64: "data:image/png;base64,AAAA", pairingCode: "ABCD-1234", count: 1 }) });
    expect(await clienteEvolution(cfg, comQr as unknown as typeof fetch).qrCode()).toEqual({ tipo: "qr", imagem: "data:image/png;base64,AAAA", codigoPareamento: "ABCD-1234" });
    const jaConectado = servidor({ "GET /instance/connect/prospeccao": () => json({ instance: { instanceName: "prospeccao", state: "open" } }) });
    expect(await clienteEvolution(cfg, jaConectado as unknown as typeof fetch).qrCode()).toEqual({ tipo: "conectada" });
    const base64Puro = servidor({ "GET /instance/connect/prospeccao": () => json({ base64: "AAAA" }) });
    expect(await clienteEvolution(cfg, base64Puro as unknown as typeof fetch).qrCode()).toMatchObject({ imagem: "data:image/png;base64,AAAA" });
  });

  it("criar instância: Baileys com QR", async () => {
    const f = servidor({ "POST /instance/create": () => json({ instance: { instanceName: "prospeccao" } }, 201) });
    expect(await clienteEvolution(cfg, f as unknown as typeof fetch).criarInstancia()).toEqual({ ok: true });
    expect(JSON.parse(String(f.mock.calls[0][1]!.body))).toEqual({ instanceName: "prospeccao", integration: "WHATSAPP-BAILEYS", qrcode: true });
  });

  it("webhook: configura só o webhook (o Chatwoot é outra rota e não é tocado) e lê de volta", async () => {
    const f = servidor({
      "POST /webhook/set/prospeccao": () => json({ webhook: { url: "x" } }, 201),
      "GET /webhook/find/prospeccao": () => json({ enabled: true, url: "https://oem.exemplo.com/api/whatsapp/prospeccao/webhook?segredo=s3", events: EVENTOS_DO_WEBHOOK }),
    });
    const c = clienteEvolution(cfg, f as unknown as typeof fetch);
    expect(await c.configurarWebhook("https://oem.exemplo.com/api/whatsapp/prospeccao/webhook?segredo=s3", "s3")).toEqual({ ok: true });
    const corpo = JSON.parse(String(f.mock.calls[0][1]!.body));
    expect(corpo).toEqual({
      webhook: {
        enabled: true,
        url: "https://oem.exemplo.com/api/whatsapp/prospeccao/webhook?segredo=s3",
        headers: { "x-webhook-secret": "s3" },
        byEvents: false,
        base64: false,
        events: ["MESSAGES_UPSERT", "MESSAGES_UPDATE", "SEND_MESSAGE", "CONNECTION_UPDATE"],
      },
    });
    expect(f.mock.calls.every(([url]) => !String(url).includes("/chatwoot/"))).toBe(true);
    expect(await c.lerWebhook()).toEqual({ ligado: true, url: "https://oem.exemplo.com/api/whatsapp/prospeccao/webhook?segredo=s3", eventos: EVENTOS_DO_WEBHOOK });
  });

  it("webhook ainda não configurado: lerWebhook devolve nulo", async () => {
    const f = servidor({ "GET /webhook/find/prospeccao": () => json(null) });
    expect(await clienteEvolution(cfg, f as unknown as typeof fetch).lerWebhook()).toBeNull();
  });
});
