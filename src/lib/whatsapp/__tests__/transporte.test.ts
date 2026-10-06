import { describe, it, expect, vi } from "vitest";
import { criarTransporteEvolution, criarTransporteSimulado, ErroDeEnvio, obterTransporte } from "../transporte";

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
    const t = obterTransporte({});
    expect(await t.estado()).toBe("desconectada");
    await expect(t.enviarTexto("+5547999998888", "x")).rejects.toMatchObject({ certezaQueNaoEnviou: true });
  });

  it("Evolution exige o interruptor WHATSAPP_ENVIO_HABILITADO=true", () => {
    expect(obterTransporte(evolution).nome).toBe("desligado");
    expect(obterTransporte({ ...evolution, WHATSAPP_ENVIO_HABILITADO: "true" }).nome).toBe("evolution");
    expect(obterTransporte({ ...evolution, WHATSAPP_ENVIO_HABILITADO: "true", EVOLUTION_APIKEY: "" }).nome).toBe("desligado");
  });

  it("simulado só funciona fora de produção", () => {
    expect(obterTransporte({ WHATSAPP_TRANSPORTE: "simulado", NODE_ENV: "development" }).nome).toBe("simulado");
    expect(obterTransporte({ WHATSAPP_TRANSPORTE: "simulado", NODE_ENV: "production" }).nome).toBe("desligado");
  });

  it("o simulado não faz rede: devolve id próprio e linha conectada", async () => {
    const t = criarTransporteSimulado();
    expect(await t.estado()).toBe("conectada");
    expect((await t.enviarTexto("+5547999998888", "x")).idExterno).toMatch(/^SIM-/);
  });
});
