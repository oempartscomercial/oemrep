import { describe, it, expect, vi } from "vitest";
import { testarChatwoot } from "../chatwoot-api";

const cfg = { url: "https://chat.exemplo.com", conta: "1", token: "tok-9z8y" };
const json = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { "content-type": "application/json" } });

describe("cliente do Chatwoot (só testar conexão nesta versão)", () => {
  it("token e conta certos: lista as caixas de entrada", async () => {
    const f = vi.fn(async () => json({ payload: [{ id: 1, name: "WhatsApp Prospecção" }, { id: 2, name: "Site" }] }));
    expect(await testarChatwoot(cfg, f as unknown as typeof fetch)).toEqual({ ok: true, caixas: ["WhatsApp Prospecção", "Site"] });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://chat.exemplo.com/api/v1/accounts/1/inboxes");
    expect((init.headers as Record<string, string>).api_access_token).toBe("tok-9z8y");
  });

  it("token recusado, conta errada e fora do ar", async () => {
    expect(await testarChatwoot(cfg, (async () => json({}, 401)) as unknown as typeof fetch)).toEqual({ ok: false, erro: "O Chatwoot recusou o token de acesso." });
    expect(await testarChatwoot(cfg, (async () => json({}, 404)) as unknown as typeof fetch)).toEqual({ ok: false, erro: "Não achei a conta 1 no Chatwoot." });
    expect(await testarChatwoot(cfg, (async () => { throw new Error("x"); }) as unknown as typeof fetch)).toEqual({ ok: false, erro: "Não consegui falar com o Chatwoot nesse endereço." });
  });
});
