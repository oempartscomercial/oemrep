import { describe, it, expect, vi, afterEach, beforeAll, afterAll } from "vitest";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";

const obterUsuarioLogadoMock = vi.fn();
vi.mock("@/lib/sessao", () => ({ obterUsuarioLogado: () => obterUsuarioLogadoMock() }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
const origemMock = vi.fn(async () => "https://oem.exemplo.com");
vi.mock("@/lib/origem", () => ({ origemDoApp: () => origemMock() }));

import {
  configurarWebhookAcao,
  criarInstanciaAcao,
  estadoEvolutionAcao,
  qrCodeAcao,
  salvarChatwootAcao,
  salvarEvolutionAcao,
  testarChatwootAcao,
  testarEvolutionAcao,
} from "../actions";

// Evolution e Chatwoot falsos: nenhuma chamada sai para os servidores de verdade.
type Rota = (corpo: unknown) => { status: number; dados: unknown };
let rotas: Record<string, Rota> = {};
const chamadas: { metodo: string; caminho: string; corpo: unknown; cabecalhos: Record<string, string> }[] = [];
const fetchFalso = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
  const u = new URL(String(url));
  const metodo = init?.method ?? "GET";
  const corpo = init?.body ? JSON.parse(String(init.body)) : undefined;
  chamadas.push({ metodo, caminho: u.pathname, corpo, cabecalhos: (init?.headers ?? {}) as Record<string, string> });
  const rota = rotas[`${metodo} ${u.pathname}`];
  const r = rota ? rota(corpo) : { status: 404, dados: { message: "não achei" } };
  return new Response(JSON.stringify(r.dados), { status: r.status, headers: { "content-type": "application/json" } });
});

let admin: { id: string; nome: string };
let analista: { id: string; nome: string };
const logar = (u: { id: string; nome: string }, perfil: "ADMIN" | "ANALISTA") => obterUsuarioLogadoMock.mockResolvedValue({ ...u, perfil, fabricasIds: [] });
const EVOLUTION = { url: "https://evo.falsa.exemplo", instancia: "prospeccao", apikey: "api-key-de-teste-1a2b", envioAutomatico: false };

beforeAll(async () => {
  const a = await prisma.usuario.create({ data: { nome: "Admin Telas", email: `integ-tela-${Date.now()}@teste.local`, perfil: "ADMIN" } });
  const b = await prisma.usuario.create({ data: { nome: "Analista Telas", email: `integ-tela-an-${Date.now()}@teste.local`, perfil: "ANALISTA" } });
  admin = { id: a.id, nome: a.nome };
  analista = { id: b.id, nome: b.nome };
  vi.stubGlobal("fetch", fetchFalso);
});
afterEach(async () => {
  vi.unstubAllEnvs();
  obterUsuarioLogadoMock.mockReset();
  rotas = {};
  chamadas.length = 0;
  await prisma.integracao.deleteMany({});
});
afterAll(async () => {
  vi.unstubAllGlobals();
  await prisma.eventoAuditoria.deleteMany({ where: { usuarioId: { in: [admin.id, analista.id] } } });
  await prisma.usuario.deleteMany({ where: { id: { in: [admin.id, analista.id] } } });
});

describe("Integrações — só ADMIN", () => {
  it("sem sessão, ANALISTA e OPERADOR são recusados em todas as ações, e nada é gravado", async () => {
    vi.stubEnv("INTEGRACOES_CHAVE", randomBytes(32).toString("hex"));
    const acoes = [
      () => salvarEvolutionAcao(EVOLUTION),
      () => salvarChatwootAcao({ url: "https://c.exemplo", conta: "1", token: "t" }),
      () => testarEvolutionAcao(),
      () => estadoEvolutionAcao(),
      () => qrCodeAcao(),
      () => criarInstanciaAcao(),
      () => configurarWebhookAcao(),
      () => testarChatwootAcao(),
    ];
    obterUsuarioLogadoMock.mockResolvedValue(null);
    for (const a of acoes) expect((await a()).erros).toEqual(["Sessão expirada. Faça login novamente."]);
    logar(analista, "ANALISTA");
    for (const a of acoes) expect((await a()).erros).toEqual(["Só administradores mexem nas integrações."]);
    expect(await prisma.integracao.count()).toBe(0);
    expect(chamadas).toHaveLength(0);
  });
});

describe("Integrações — Evolution", () => {
  it("sem INTEGRACOES_CHAVE a tela explica e não salva", async () => {
    vi.stubEnv("INTEGRACOES_CHAVE", "");
    logar(admin, "ADMIN");
    const r = await salvarEvolutionAcao(EVOLUTION);
    expect(r.erros[0]).toContain("INTEGRACOES_CHAVE");
    expect(await prisma.integracao.count()).toBe(0);
  });

  it("testar conexão usa a chave salva no cabeçalho e diz se a instância existe e se está conectada", async () => {
    vi.stubEnv("INTEGRACOES_CHAVE", randomBytes(32).toString("hex"));
    logar(admin, "ADMIN");
    expect((await testarEvolutionAcao()).erros).toEqual(["Salve a configuração da Evolution antes."]);
    expect((await salvarEvolutionAcao(EVOLUTION)).erros).toEqual([]);
    rotas["GET /instance/fetchInstances"] = () => ({ status: 200, dados: [{ name: "prospeccao", connectionStatus: "close" }] });
    const r = await testarEvolutionAcao();
    expect(r).toMatchObject({ erros: [], estado: { existe: true, estado: "desconectada" } });
    expect(r.mensagem).toContain("Conexão com a Evolution OK");
    expect(chamadas[0].cabecalhos.apikey).toBe("api-key-de-teste-1a2b");
    expect(JSON.stringify(r)).not.toContain("api-key-de-teste");
  });

  it("cria a instância quando não existe e mostra o QR Code; conectado, avisa", async () => {
    vi.stubEnv("INTEGRACOES_CHAVE", randomBytes(32).toString("hex"));
    logar(admin, "ADMIN");
    await salvarEvolutionAcao(EVOLUTION);
    rotas["GET /instance/fetchInstances"] = () => ({ status: 200, dados: [] });
    rotas["POST /instance/create"] = () => ({ status: 201, dados: { instance: { instanceName: "prospeccao" } } });
    expect((await criarInstanciaAcao()).erros).toEqual([]);
    expect(chamadas.find((c) => c.caminho === "/instance/create")?.corpo).toEqual({ instanceName: "prospeccao", integration: "WHATSAPP-BAILEYS", qrcode: true });

    rotas["GET /instance/connect/prospeccao"] = () => ({ status: 200, dados: { base64: "data:image/png;base64,QRQR", pairingCode: null } });
    expect(await qrCodeAcao()).toEqual({ erros: [], imagem: "data:image/png;base64,QRQR", codigoPareamento: null });
    rotas["GET /instance/connect/prospeccao"] = () => ({ status: 200, dados: { instance: { state: "open" } } });
    expect(await qrCodeAcao()).toEqual({ erros: [], conectado: true });
  });

  it("configura o webhook apontando para o sistema, guarda o segredo cifrado e não mexe no Chatwoot", async () => {
    vi.stubEnv("INTEGRACOES_CHAVE", randomBytes(32).toString("hex"));
    logar(admin, "ADMIN");
    await salvarEvolutionAcao(EVOLUTION);
    let configurado: { url: string; events: string[] } | null = null;
    rotas["GET /webhook/find/prospeccao"] = () => ({ status: 200, dados: configurado ? { enabled: true, ...configurado } : null });
    rotas["POST /webhook/set/prospeccao"] = (corpo) => {
      configurado = (corpo as { webhook: { url: string; events: string[] } }).webhook;
      return { status: 201, dados: {} };
    };
    const r = await configurarWebhookAcao();
    expect(r).toEqual({ erros: [], conferido: true });
    const linha = await prisma.integracao.findUniqueOrThrow({ where: { tipo: "EVOLUTION" } });
    expect(linha.webhookConfiguradoEm).not.toBeNull();
    expect(configurado!.url).toMatch(/^https:\/\/oem\.exemplo\.com\/api\/whatsapp\/prospeccao\/webhook\?segredo=[0-9a-f]{48}$/);
    const segredo = configurado!.url.split("segredo=")[1];
    expect(linha.webhookSegredoCifrado).not.toContain(segredo);
    expect(chamadas.some((c) => c.caminho.includes("chatwoot"))).toBe(false);

    // Configurar de novo reaproveita o mesmo segredo.
    await configurarWebhookAcao();
    expect(configurado!.url.split("segredo=")[1]).toBe(segredo);
  });

  it("webhook apontando para outro endereço: pede confirmação antes de trocar; endereço local é recusado", async () => {
    vi.stubEnv("INTEGRACOES_CHAVE", randomBytes(32).toString("hex"));
    logar(admin, "ADMIN");
    await salvarEvolutionAcao(EVOLUTION);
    rotas["GET /webhook/find/prospeccao"] = () => ({ status: 200, dados: { enabled: true, url: "https://n8n.exemplo/webhook/abc?token=segredo-de-outro", events: ["MESSAGES_UPSERT"] } });
    rotas["POST /webhook/set/prospeccao"] = () => ({ status: 201, dados: {} });
    const r = await configurarWebhookAcao();
    expect(r).toEqual({ erros: [], precisaConfirmar: { urlAtual: "https://n8n.exemplo/webhook/abc" } });
    expect(chamadas.some((c) => c.metodo === "POST")).toBe(false);
    const substituido = await configurarWebhookAcao({ substituir: true });
    expect(substituido.erros).toEqual([]);
    expect(chamadas.some((c) => c.caminho === "/webhook/set/prospeccao")).toBe(true);

    origemMock.mockResolvedValueOnce("http://localhost:3000");
    expect((await configurarWebhookAcao({ substituir: true })).erros[0]).toContain("endereço deste sistema é local");
  });
});

describe("Integrações — Chatwoot", () => {
  it("salva (token mascarado) e testa a conexão", async () => {
    vi.stubEnv("INTEGRACOES_CHAVE", randomBytes(32).toString("hex"));
    logar(admin, "ADMIN");
    expect((await salvarChatwootAcao({ url: "https://chat.falso.exemplo", conta: "1", token: "token-de-teste-7x7x" })).erros).toEqual([]);
    rotas["GET /api/v1/accounts/1/inboxes"] = () => ({ status: 200, dados: { payload: [{ name: "WhatsApp Prospecção" }] } });
    expect(await testarChatwootAcao()).toEqual({ erros: [], mensagem: "Conexão com o Chatwoot OK. Caixas de entrada: WhatsApp Prospecção." });
    expect(chamadas[0].cabecalhos.api_access_token).toBe("token-de-teste-7x7x");
    const linha = await prisma.integracao.findUniqueOrThrow({ where: { tipo: "CHATWOOT" } });
    expect(linha.segredoFinal).toBe("7x7x");
  });
});
