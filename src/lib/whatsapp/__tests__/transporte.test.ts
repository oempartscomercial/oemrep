import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from "vitest";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { salvarEvolution } from "@/lib/integracoes/config";
import { criarTransporteEvolution, criarTransporteSimulado, envioAutomaticoLigado, ErroDeEnvio, obterTransporte } from "../transporte";

const cfg = { url: "https://evo.exemplo.com/", apikey: "chave-secreta", instancia: "oem" };
const resposta = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { "content-type": "application/json" } });

describe("transporte Evolution", () => {
  it("envia texto com o número só em dígitos e devolve o id da mensagem", async () => {
    const fetchFn = vi.fn().mockResolvedValue(resposta({ key: { id: "3EB0XYZ" } }, 201));
    const t = criarTransporteEvolution(cfg, fetchFn as unknown as typeof fetch);
    expect(await t.enviarTexto("+5547999998888", "Olá")).toEqual({ idExterno: "3EB0XYZ" });
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe("https://evo.exemplo.com/message/sendText/oem");
    expect(init.method).toBe("POST");
    expect(init.headers.apikey).toBe("chave-secreta");
    expect(JSON.parse(init.body)).toEqual({ number: "5547999998888", text: "Olá" });
  });

  it("erro 4xx: tem certeza de que não enviou", async () => {
    const t = criarTransporteEvolution(cfg, (async () => resposta({ message: "x" }, 400)) as unknown as typeof fetch);
    await expect(t.enviarTexto("+5547999998888", "Olá")).rejects.toMatchObject({ certezaQueNaoEnviou: true });
  });

  it("erro 5xx, queda de rede ou resposta sem id: não dá para saber se enviou", async () => {
    const casos: (typeof fetch)[] = [
      (async () => resposta({}, 500)) as unknown as typeof fetch,
      (async () => { throw new Error("timeout"); }) as unknown as typeof fetch,
      (async () => resposta({ ok: true }, 200)) as unknown as typeof fetch,
    ];
    for (const f of casos) {
      const erro = await criarTransporteEvolution(cfg, f).enviarTexto("+5547999998888", "Olá").catch((e) => e);
      expect(erro).toBeInstanceOf(ErroDeEnvio);
      expect(erro.certezaQueNaoEnviou).toBe(false);
    }
  });

  it("estado da linha: open = conectada, close = desconectada, o resto ou falha = desconhecida", async () => {
    const com = (corpo: unknown) => criarTransporteEvolution(cfg, (async () => resposta(corpo)) as unknown as typeof fetch).estado();
    expect(await com({ instance: { state: "open" } })).toBe("conectada");
    expect(await com({ instance: { state: "close" } })).toBe("desconectada");
    expect(await com({ instance: { state: "connecting" } })).toBe("desconhecida");
    expect(await criarTransporteEvolution(cfg, (async () => { throw new Error("x"); }) as unknown as typeof fetch).estado()).toBe("desconhecida");
  });
});

describe("obterTransporte — nada sai sem estar ligado de propósito", () => {
  const evolution = { WHATSAPP_TRANSPORTE: "evolution", EVOLUTION_URL: "https://e", EVOLUTION_APIKEY: "k", EVOLUTION_INSTANCIA_PROSPECCAO: "i" };

  it("sem configuração é desligado: linha desconectada e envio recusado com certeza", async () => {
    const t = await obterTransporte({});
    expect(await t.estado()).toBe("desconectada");
    await expect(t.enviarTexto("+5547999998888", "x")).rejects.toMatchObject({ certezaQueNaoEnviou: true });
  });

  it("Evolution exige o interruptor WHATSAPP_ENVIO_HABILITADO=true", async () => {
    expect((await obterTransporte(evolution)).nome).toBe("desligado");
    expect((await obterTransporte({ ...evolution, WHATSAPP_ENVIO_HABILITADO: "true" })).nome).toBe("evolution");
    expect((await obterTransporte({ ...evolution, WHATSAPP_ENVIO_HABILITADO: "true", EVOLUTION_APIKEY: "" })).nome).toBe("desligado");
  });

  it("simulado só funciona fora de produção", async () => {
    expect((await obterTransporte({ WHATSAPP_TRANSPORTE: "simulado", NODE_ENV: "development" })).nome).toBe("simulado");
    expect((await obterTransporte({ WHATSAPP_TRANSPORTE: "simulado", NODE_ENV: "production" })).nome).toBe("desligado");
  });

  it("o simulado não faz rede: devolve id próprio e linha conectada", async () => {
    const t = criarTransporteSimulado();
    expect(await t.estado()).toBe("conectada");
    expect((await t.enviarTexto("+5547999998888", "x")).idExterno).toMatch(/^SIM-/);
  });

  it("envioAutomaticoLigado diz à tela se a mensagem aprovada sai sozinha ou pelo celular", async () => {
    expect(await envioAutomaticoLigado({})).toBe(false);
    expect(await envioAutomaticoLigado(evolution)).toBe(false);
    expect(await envioAutomaticoLigado({ ...evolution, WHATSAPP_ENVIO_HABILITADO: "true" })).toBe(true);
    expect(await envioAutomaticoLigado({ WHATSAPP_TRANSPORTE: "simulado", NODE_ENV: "development" })).toBe(true);
  });
});

describe("obterTransporte — configuração da tela Integrações (banco)", () => {
  const CHAVE = randomBytes(32).toString("hex");
  let admin: { id: string; nome: string };

  beforeAll(async () => {
    const u = await prisma.usuario.create({ data: { nome: "Admin Transporte", email: `transp-${Date.now()}@teste.local`, perfil: "ADMIN" } });
    admin = { id: u.id, nome: u.nome };
  });
  afterEach(async () => {
    await prisma.integracao.deleteMany({});
  });
  afterAll(async () => {
    await prisma.eventoAuditoria.deleteMany({ where: { usuarioId: admin.id } });
    await prisma.usuario.delete({ where: { id: admin.id } });
  });

  it("lê a Evolution do banco e envia pelo endereço e chave salvos, só com o envio automático ligado", async () => {
    const env = { INTEGRACOES_CHAVE: CHAVE };
    await salvarEvolution(admin, { url: "https://evo.banco.com", instancia: "prospeccao", apikey: "chave-do-banco", envioAutomatico: false }, env);
    expect((await obterTransporte(env)).nome).toBe("desligado");

    await salvarEvolution(admin, { url: "https://evo.banco.com", instancia: "prospeccao", apikey: "", envioAutomatico: true }, env);
    const t = await obterTransporte(env);
    expect(t.nome).toBe("evolution");

    const fetchFn = vi.fn().mockResolvedValue(resposta({ key: { id: "ID-1" } }, 201));
    vi.stubGlobal("fetch", fetchFn);
    try {
      await (await obterTransporte(env)).enviarTexto("+5547999998888", "Olá");
    } finally {
      vi.unstubAllGlobals();
    }
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe("https://evo.banco.com/message/sendText/prospeccao");
    expect(init.headers.apikey).toBe("chave-do-banco");
  });

  it("a tela vence as variáveis antigas; configuração salva que não abre (chave trocada) desliga o envio", async () => {
    await salvarEvolution(admin, { url: "https://evo.banco.com", instancia: "prospeccao", apikey: "k", envioAutomatico: false }, { INTEGRACOES_CHAVE: CHAVE });
    const antigas = { WHATSAPP_TRANSPORTE: "evolution", WHATSAPP_ENVIO_HABILITADO: "true", EVOLUTION_URL: "https://e", EVOLUTION_APIKEY: "k", EVOLUTION_INSTANCIA_PROSPECCAO: "i" };
    expect((await obterTransporte({ ...antigas, INTEGRACOES_CHAVE: CHAVE })).nome).toBe("desligado");
    const erro = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await obterTransporte({ INTEGRACOES_CHAVE: randomBytes(32).toString("hex") })).nome).toBe("desligado");
    expect((await obterTransporte({})).nome).toBe("desligado");
    erro.mockRestore();
  });
});
