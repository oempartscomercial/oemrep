import { describe, it, expect, vi, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { POST } from "../route";

const SEGREDO = "segredo-de-teste-da-prospeccao";
const ctx = (linha: string) => ({ params: Promise.resolve({ linha }) });
const requisicao = (corpo: unknown, cabecalhos: Record<string, string> = { "x-webhook-secret": SEGREDO }, url = "http://x/api/whatsapp/prospeccao/webhook") =>
  new NextRequest(url, { method: "POST", headers: cabecalhos, body: typeof corpo === "string" ? corpo : JSON.stringify(corpo) });

afterEach(() => vi.unstubAllEnvs());

describe("webhook do WhatsApp", () => {
  it("linha que não existe → 404", async () => {
    vi.stubEnv("WHATSAPP_WEBHOOK_SEGREDO_PROSPECCAO", SEGREDO);
    expect((await POST(requisicao({}), ctx("outra"))).status).toBe(404);
  });

  it("linha do assistente ainda não recebe nada (fase 3) → 404", async () => {
    vi.stubEnv("WHATSAPP_WEBHOOK_SEGREDO_PROSPECCAO", SEGREDO);
    expect((await POST(requisicao({}), ctx("assistente"))).status).toBe(404);
  });

  // Os arquivos de teste rodam em paralelo no mesmo banco: o "nada gravado" olha só o
  // evento marcado aqui, não a tabela inteira.
  const gravados = (marcador: string) => prisma.eventoWhatsapp.count({ where: { payload: { path: ["marcador"], equals: marcador } } });

  it("sem segredo configurado, recusa tudo → 503 e nada é gravado", async () => {
    vi.stubEnv("WHATSAPP_WEBHOOK_SEGREDO_PROSPECCAO", "");
    expect((await POST(requisicao({ marcador: "sem-segredo" }), ctx("prospeccao"))).status).toBe(503);
    expect(await gravados("sem-segredo")).toBe(0);
  });

  it("segredo errado ou ausente → 401 e nada é gravado", async () => {
    vi.stubEnv("WHATSAPP_WEBHOOK_SEGREDO_PROSPECCAO", SEGREDO);
    expect((await POST(requisicao({ marcador: "segredo-errado" }, { "x-webhook-secret": "errado" }), ctx("prospeccao"))).status).toBe(401);
    expect((await POST(requisicao({ marcador: "segredo-errado" }, {}), ctx("prospeccao"))).status).toBe(401);
    expect(await gravados("segredo-errado")).toBe(0);
  });

  it("corpo que não é JSON → 400", async () => {
    vi.stubEnv("WHATSAPP_WEBHOOK_SEGREDO_PROSPECCAO", SEGREDO);
    expect((await POST(requisicao("isto não é json"), ctx("prospeccao"))).status).toBe(400);
  });

  it("corpo grande demais → 413", async () => {
    vi.stubEnv("WHATSAPP_WEBHOOK_SEGREDO_PROSPECCAO", SEGREDO);
    const enorme = JSON.stringify({ event: "x", lixo: "a".repeat(1_100_000) });
    expect((await POST(requisicao(enorme), ctx("prospeccao"))).status).toBe(413);
  });

  it("evento válido → 200, grava o evento bruto e a mensagem (segredo no cabeçalho, no Bearer ou na URL)", async () => {
    vi.stubEnv("WHATSAPP_WEBHOOK_SEGREDO_PROSPECCAO", SEGREDO);
    const ids: string[] = [];
    const numero = `559997${String(Date.now()).slice(-7)}`;
    try {
      const variantes: [string, Record<string, string>, string][] = [
        ["WH-1", { "x-webhook-secret": SEGREDO }, "http://x/api/whatsapp/prospeccao/webhook"],
        ["WH-2", { authorization: `Bearer ${SEGREDO}` }, "http://x/api/whatsapp/prospeccao/webhook"],
        ["WH-3", {}, `http://x/api/whatsapp/prospeccao/webhook?segredo=${SEGREDO}`],
      ];
      for (const [id, cabecalhos, url] of variantes) {
        const corpo = { event: "messages.upsert", data: { key: { remoteJid: `${numero}@s.whatsapp.net`, fromMe: false, id }, message: { conversation: "oi" }, messageTimestamp: 1_791_300_000 } };
        const r = await POST(requisicao(corpo, cabecalhos, url), ctx("prospeccao"));
        expect(r.status).toBe(200);
        const json = await r.json();
        expect(json.ok).toBe(true);
        ids.push(json.eventoId);
      }
      expect(await prisma.mensagem.count({ where: { idExterno: { in: ["WH-1", "WH-2", "WH-3"] } } })).toBe(3);
      expect((await prisma.eventoWhatsapp.findUniqueOrThrow({ where: { id: ids[0] } })).resultado).toBe("mensagem");
    } finally {
      const conversas = await prisma.conversa.findMany({ where: { mensagens: { some: { idExterno: { in: ["WH-1", "WH-2", "WH-3"] } } } }, select: { id: true } });
      await prisma.mensagem.deleteMany({ where: { conversaId: { in: conversas.map((c) => c.id) } } });
      await prisma.conversa.deleteMany({ where: { id: { in: conversas.map((c) => c.id) } } });
      await prisma.eventoWhatsapp.deleteMany({ where: { id: { in: ids } } });
    }
  });
});
