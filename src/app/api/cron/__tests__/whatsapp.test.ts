import { describe, it, expect, vi, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { enviarAprovadas } from "@/lib/whatsapp/enviar-aprovadas";
import { prisma } from "@/lib/prisma";
import { GET, POST } from "../whatsapp/route";

// O envio real tem teste de integração próprio (enviar-aprovadas.test.ts); aqui só interessa a porta.
vi.mock("@/lib/whatsapp/enviar-aprovadas", () => ({
  TRAVA_DO_ENVIO: "teste:cron-whatsapp",
  enviarAprovadas: vi.fn(async () => ({ enviadas: 1, aguardando: 0, canceladas: 0 })),
}));

const SEGREDO = "segredo-de-teste-do-cron-123";
const requisicao = (cabecalhos: Record<string, string> = {}) => new NextRequest("http://x/api/cron/whatsapp", { headers: cabecalhos });

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("cron de envio agendado do WhatsApp", () => {
  it("sem CRON_SECRET configurado → 503 e nada é enviado", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const r = await GET(requisicao({ authorization: `Bearer ${SEGREDO}` }));
    expect(r.status).toBe(503);
    expect(enviarAprovadas).not.toHaveBeenCalled();
  });

  it("segredo errado ou ausente → 401 e nada é enviado", async () => {
    vi.stubEnv("CRON_SECRET", SEGREDO);
    expect((await GET(requisicao({ authorization: "Bearer errado" }))).status).toBe(401);
    expect((await GET(requisicao({}))).status).toBe(401);
    expect(enviarAprovadas).not.toHaveBeenCalled();
  });

  it("segredo certo, no Bearer que a Vercel envia → 200, roda o envio e devolve o resumo", async () => {
    vi.stubEnv("CRON_SECRET", SEGREDO);
    const r = await GET(requisicao({ authorization: `Bearer ${SEGREDO}` }));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, enviadas: 1, aguardando: 0, canceladas: 0 });
    expect(enviarAprovadas).toHaveBeenCalledTimes(1);
  });

  it("POST também vale (agendador do Supabase), com o mesmo segredo", async () => {
    vi.stubEnv("CRON_SECRET", SEGREDO);
    const r = await POST(new NextRequest("http://x/api/cron/whatsapp", { method: "POST", headers: { authorization: `Bearer ${SEGREDO}` } }));
    expect(r.status).toBe(200);
    expect(enviarAprovadas).toHaveBeenCalledTimes(1);
  });

  it("com outra execução em andamento, responde 200 sem enviar nada", async () => {
    vi.stubEnv("CRON_SECRET", SEGREDO);
    await prisma.trava.upsert({ where: { chave: "teste:cron-whatsapp" }, create: { chave: "teste:cron-whatsapp", dono: "outra", ocupadaAte: new Date(Date.now() + 60_000) }, update: { dono: "outra", ocupadaAte: new Date(Date.now() + 60_000) } });
    try {
      const r = await GET(requisicao({ authorization: `Bearer ${SEGREDO}` }));
      expect(r.status).toBe(200);
      expect(await r.json()).toEqual({ ok: true, ignorado: "Outra execução está em andamento." });
      expect(enviarAprovadas).not.toHaveBeenCalled();
    } finally {
      await prisma.trava.deleteMany({ where: { chave: "teste:cron-whatsapp" } });
    }
  });
});
