import { describe, it, expect, vi, afterEach, beforeAll, afterAll } from "vitest";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import {
  lerChatwoot,
  lerEvolution,
  registrarEstadoDaConexao,
  resumoDasIntegracoes,
  salvarChatwoot,
  salvarEvolution,
  salvarSegredoDoWebhook,
  segredosDoWebhook,
} from "../config";

const CHAVE = randomBytes(32).toString("hex");
let admin: { id: string; nome: string };

beforeAll(async () => {
  const u = await prisma.usuario.create({ data: { nome: "Admin Integrações", email: `integ-${Date.now()}@teste.local`, perfil: "ADMIN" } });
  admin = { id: u.id, nome: u.nome };
});
afterEach(async () => {
  vi.unstubAllEnvs();
  await prisma.integracao.deleteMany({});
});
afterAll(async () => {
  await prisma.eventoAuditoria.deleteMany({ where: { usuarioId: admin.id } });
  await prisma.usuario.delete({ where: { id: admin.id } });
});

const entradaEvolution = { url: "https://evo.exemplo.com/", instancia: "prospeccao", apikey: "api-key-secreta-1a2b", envioAutomatico: false };

describe("configuração das integrações no banco", () => {
  it("sem INTEGRACOES_CHAVE não salva e explica", async () => {
    vi.stubEnv("INTEGRACOES_CHAVE", "");
    const r = await salvarEvolution(admin, entradaEvolution);
    expect(r.erros[0]).toContain("INTEGRACOES_CHAVE");
    expect(await prisma.integracao.count()).toBe(0);
  });

  it("salva a Evolution com a chave cifrada, mostra só o final e lê de volta decifrada", async () => {
    vi.stubEnv("INTEGRACOES_CHAVE", CHAVE);
    expect((await salvarEvolution(admin, entradaEvolution)).erros).toEqual([]);
    const linha = await prisma.integracao.findUniqueOrThrow({ where: { tipo: "EVOLUTION" } });
    expect(linha.segredoCifrado).not.toContain("api-key-secreta");
    expect(linha.segredoFinal).toBe("1a2b");
    expect(linha.url).toBe("https://evo.exemplo.com");

    const cfg = await lerEvolution();
    expect(cfg).toMatchObject({ url: "https://evo.exemplo.com", apikey: "api-key-secreta-1a2b", instancia: "prospeccao", envioAutomatico: false, origem: "tela" });

    const resumo = await resumoDasIntegracoes();
    expect(resumo.cifraConfigurada).toBe(true);
    expect(resumo.evolution).toMatchObject({ url: "https://evo.exemplo.com", instancia: "prospeccao", segredo: "••••1a2b", origem: "tela" });
    expect(JSON.stringify(resumo)).not.toContain("api-key-secreta");
  });

  it("chave vazia ao editar mantém a salva; trocar endereço ou instância pede o webhook de novo", async () => {
    vi.stubEnv("INTEGRACOES_CHAVE", CHAVE);
    await salvarEvolution(admin, entradaEvolution);
    await salvarSegredoDoWebhook(admin, "segredo-do-webhook-123456");
    expect((await prisma.integracao.findUniqueOrThrow({ where: { tipo: "EVOLUTION" } })).webhookConfiguradoEm).not.toBeNull();

    expect((await salvarEvolution(admin, { ...entradaEvolution, apikey: "", envioAutomatico: true })).erros).toEqual([]);
    expect(await lerEvolution()).toMatchObject({ apikey: "api-key-secreta-1a2b", envioAutomatico: true, webhookSegredo: "segredo-do-webhook-123456" });
    expect((await prisma.integracao.findUniqueOrThrow({ where: { tipo: "EVOLUTION" } })).webhookConfiguradoEm).not.toBeNull();

    await salvarEvolution(admin, { ...entradaEvolution, apikey: "", instancia: "outra" });
    expect((await prisma.integracao.findUniqueOrThrow({ where: { tipo: "EVOLUTION" } })).webhookConfiguradoEm).toBeNull();
  });

  it("auditoria registra o que mudou, mas nunca o segredo", async () => {
    vi.stubEnv("INTEGRACOES_CHAVE", CHAVE);
    await salvarEvolution(admin, entradaEvolution);
    await salvarEvolution(admin, { ...entradaEvolution, apikey: "outra-chave-9z9z", envioAutomatico: true });
    await salvarSegredoDoWebhook(admin, "segredo-do-webhook-123456");
    const eventos = await prisma.eventoAuditoria.findMany({ where: { usuarioId: admin.id, entidade: "Integracao" } });
    const campos = eventos.map((e) => e.campo);
    expect(campos).toEqual(expect.arrayContaining(["url", "instancia", "chave", "envioAutomatico", "webhook"]));
    const tudo = JSON.stringify(eventos);
    for (const segredo of ["api-key-secreta", "outra-chave", "9z9z", "1a2b", "segredo-do-webhook"]) expect(tudo).not.toContain(segredo);
  });

  it("sem nada na tela, vale a configuração antiga das variáveis EVOLUTION_*", async () => {
    vi.stubEnv("INTEGRACOES_CHAVE", CHAVE);
    expect(await lerEvolution({})).toBeNull();
    const env = { WHATSAPP_TRANSPORTE: "evolution", WHATSAPP_ENVIO_HABILITADO: "true", EVOLUTION_URL: "https://env", EVOLUTION_APIKEY: "k", EVOLUTION_INSTANCIA_PROSPECCAO: "i" };
    expect(await lerEvolution(env)).toMatchObject({ url: "https://env", apikey: "k", instancia: "i", envioAutomatico: true, origem: "ambiente" });
    expect(await lerEvolution({ ...env, WHATSAPP_ENVIO_HABILITADO: "" })).toMatchObject({ envioAutomatico: false });
    // A tela manda quando existe: o ambiente deixa de valer.
    await salvarEvolution(admin, entradaEvolution);
    expect(await lerEvolution({ ...env, INTEGRACOES_CHAVE: CHAVE })).toMatchObject({ url: "https://evo.exemplo.com", origem: "tela" });
  });

  it("segredos aceitos no webhook: o da tela e o da variável antiga", async () => {
    vi.stubEnv("INTEGRACOES_CHAVE", CHAVE);
    vi.stubEnv("WHATSAPP_WEBHOOK_SEGREDO_PROSPECCAO", "segredo-antigo-da-variavel");
    expect(await segredosDoWebhook()).toEqual(["segredo-antigo-da-variavel"]);
    await salvarEvolution(admin, entradaEvolution);
    await salvarSegredoDoWebhook(admin, "segredo-do-webhook-123456");
    expect((await segredosDoWebhook()).sort()).toEqual(["segredo-antigo-da-variavel", "segredo-do-webhook-123456"]);
  });

  it("guarda o último estado de conexão avisado pela Evolution", async () => {
    vi.stubEnv("INTEGRACOES_CHAVE", CHAVE);
    await registrarEstadoDaConexao("open"); // sem configuração: não faz nada
    await salvarEvolution(admin, entradaEvolution);
    await registrarEstadoDaConexao("close");
    const linha = await prisma.integracao.findUniqueOrThrow({ where: { tipo: "EVOLUTION" } });
    expect(linha.estadoConexao).toBe("close");
    expect(linha.estadoConexaoEm).not.toBeNull();
  });

  it("Chatwoot: salva, lê decifrado e mascara", async () => {
    vi.stubEnv("INTEGRACOES_CHAVE", CHAVE);
    expect((await salvarChatwoot(admin, { url: "https://chat.exemplo.com", conta: "1", token: "token-chatwoot-7x7x" })).erros).toEqual([]);
    expect(await lerChatwoot()).toEqual({ url: "https://chat.exemplo.com", conta: "1", token: "token-chatwoot-7x7x" });
    expect((await resumoDasIntegracoes()).chatwoot).toMatchObject({ conta: "1", segredo: "••••7x7x" });
    expect((await salvarChatwoot(admin, { url: "https://chat.exemplo.com", conta: "", token: "" })).erros).toHaveLength(1);
  });
});
