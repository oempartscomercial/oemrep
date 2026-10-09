import { describe, it, expect, vi, afterEach } from "vitest";
import { consultarSsw, linkPublicoSsw, TIMEOUT_SSW_MS, URL_TRACKING_SSW } from "../ssw";
import { statusSugerido } from "@/domain/rastreio/ocorrencia";

// Chave fictícia de 44 dígitos (a consulta não valida o dígito verificador; o SSW valida).
const CHAVE = "3".repeat(44);

// Mesmo formato da resposta real do SSW, com nomes, CNPJs e endereços trocados.
const RESPOSTA_ENCONTRADA = {
  success: true,
  message: "Documento localizado com sucesso",
  documento: {
    header: {
      remetente: "Fabrica Exemplo Industria Ltda",
      destinatario: "Autopecas Exemplo Ltda",
      nro_nf: "1234",
      pedido: "",
    },
    tracking: [
      {
        data_hora: "2026-10-08T00:14:57",
        dominio: "EXE",
        filial: "AAA",
        cidade: "CIDADE ORIGEM / SP",
        ocorrencia: "DOCUMENTO DE TRANSPORTE EMITIDO (70)",
        descricao:
          "CT-e autorizado com 1 volume e 14 Kg. Destino: MA/SAO LUIS. Previsao de entrega: 23/10/26.",
        tipo: "Informativo",
        data_hora_efetiva: "2026-10-08T00:14:57",
        nome_recebedor: "",
        nro_doc_recebedor: "",
        codigo_ssw: "80",
      },
      {
        data_hora: "2026-10-08T00:49:01",
        dominio: "EXE",
        filial: "AAA",
        cidade: "CIDADE ORIGEM / SP",
        ocorrencia: "SAIDA DE UNIDADE (72)",
        descricao:
          "Saida da unidade CIDADE ORIGEM em 08/10/26, 00:49h. Previsao de chegada na unidade CIDADE ORIGEM em 08/10/26, 01:48h.",
        tipo: "Informativo",
        data_hora_efetiva: "2026-10-08T00:49:01",
        nome_recebedor: "",
        nro_doc_recebedor: "",
        codigo_ssw: "82",
      },
      {
        data_hora: "2026-10-09T08:18:55",
        dominio: "EXE",
        filial: "BBB",
        cidade: "CIDADE ORIGEM / SP",
        ocorrencia: "CHEGADA EM UNIDADE DE TRANSBORDO (75)",
        descricao: "Chegada na unidade CIDADE ORIGEM em 09/10/26, 08:18h.",
        tipo: "Informativo",
        data_hora_efetiva: "2026-10-09T08:18:55",
        nome_recebedor: "",
        nro_doc_recebedor: "",
        codigo_ssw: "83",
      },
    ],
  },
};

const RESPOSTA_NAO_ENCONTRADA = { success: false, message: "Nenhum documento localizado" };

function respostaJson(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// fetch falso: devolve sempre a mesma resposta e guarda as chamadas.
function fetchQueDevolve(resposta: Response) {
  const fake = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async () =>
    resposta.clone(),
  );
  return { fake, fetchImpl: fake as unknown as typeof fetch };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("consultarSsw: requisição", () => {
  it("faz POST JSON no endpoint com a chave só com dígitos", async () => {
    const { fake, fetchImpl } = fetchQueDevolve(respostaJson(RESPOSTA_NAO_ENCONTRADA));

    await consultarSsw(CHAVE.replace(/(\d{4})/g, "$1 "), fetchImpl);

    expect(fake).toHaveBeenCalledTimes(1);
    const [url, init] = fake.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(URL_TRACKING_SSW);
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init.body as string)).toEqual({ chave_nfe: CHAVE });
  });

  it("chave com menos de 44 dígitos é recusada sem chamar a SSW", async () => {
    const { fake, fetchImpl } = fetchQueDevolve(respostaJson(RESPOSTA_ENCONTRADA));

    const r = await consultarSsw("123", fetchImpl);

    expect(fake).not.toHaveBeenCalled();
    expect(r).toEqual({ ok: false, erro: expect.any(String), tentarDeNovo: false });
  });

  it("chave com mais de 44 dígitos também é recusada", async () => {
    const { fake, fetchImpl } = fetchQueDevolve(respostaJson(RESPOSTA_ENCONTRADA));

    const r = await consultarSsw(CHAVE + "0", fetchImpl);

    expect(fake).not.toHaveBeenCalled();
    expect(r.ok).toBe(false);
  });
});

describe("consultarSsw: encontrado", () => {
  it("devolve as ocorrências normalizadas, na ordem da SSW", async () => {
    const { fetchImpl } = fetchQueDevolve(respostaJson(RESPOSTA_ENCONTRADA));

    const r = await consultarSsw(CHAVE, fetchImpl);

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.encontrado).toBe(true);
    expect(r.ocorrencias.map((o) => o.descricao)).toEqual([
      "DOCUMENTO DE TRANSPORTE EMITIDO",
      "SAIDA DE UNIDADE",
      "CHEGADA EM UNIDADE DE TRANSBORDO",
    ]);
    expect(r.ocorrencias.map((o) => o.codigo)).toEqual(["70", "72", "75"]);
    expect(r.ocorrencias[0].local).toBe("CIDADE ORIGEM / SP");
  });

  it("interpreta a data como horário de Brasília (UTC-3)", async () => {
    const { fetchImpl } = fetchQueDevolve(respostaJson(RESPOSTA_ENCONTRADA));

    const r = await consultarSsw(CHAVE, fetchImpl);

    if (!r.ok) throw new Error("esperava sucesso");
    // 00:14:57 em Brasília = 03:14:57 UTC.
    expect(r.ocorrencias[0].data?.toISOString()).toBe("2026-10-08T03:14:57.000Z");
    expect(r.ocorrencias[2].data?.toISOString()).toBe("2026-10-09T11:18:55.000Z");
  });

  it("extrai a previsão de entrega do texto da ocorrência", async () => {
    const { fetchImpl } = fetchQueDevolve(respostaJson(RESPOSTA_ENCONTRADA));

    const r = await consultarSsw(CHAVE, fetchImpl);

    if (!r.ok) throw new Error("esperava sucesso");
    // "23/10/26" = 23 de outubro de 2026, 00:00 de Brasília.
    expect(r.previsaoEntrega?.toISOString()).toBe("2026-10-23T03:00:00.000Z");
  });

  it("transportadora é null, já que o formato observado não traz o nome", async () => {
    const { fetchImpl } = fetchQueDevolve(respostaJson(RESPOSTA_ENCONTRADA));

    const r = await consultarSsw(CHAVE, fetchImpl);

    if (!r.ok) throw new Error("esperava sucesso");
    expect(r.transportadoraNome).toBeNull();
  });

  it("guarda a resposta crua em bruto", async () => {
    const { fetchImpl } = fetchQueDevolve(respostaJson(RESPOSTA_ENCONTRADA));

    const r = await consultarSsw(CHAVE, fetchImpl);

    if (!r.ok) throw new Error("esperava sucesso");
    expect(r.bruto).toEqual(RESPOSTA_ENCONTRADA);
  });

  it("nas ocorrências acima o status sugerido é TRANSITO", async () => {
    const { fetchImpl } = fetchQueDevolve(respostaJson(RESPOSTA_ENCONTRADA));

    const r = await consultarSsw(CHAVE, fetchImpl);

    if (!r.ok) throw new Error("esperava sucesso");
    expect(statusSugerido(r.ocorrencias)).toBe("TRANSITO");
  });

  it("aceita data no formato dd/mm/yyyy hh:mm e ignora data inexistente", async () => {
    const corpo = structuredClone(RESPOSTA_ENCONTRADA);
    corpo.documento.tracking = [
      { ...corpo.documento.tracking[0], data_hora: "08/10/2026 10:30", data_hora_efetiva: "" },
      { ...corpo.documento.tracking[1], data_hora: "31/02/2026 10:30", data_hora_efetiva: "" },
    ];
    const { fetchImpl } = fetchQueDevolve(respostaJson(corpo));

    const r = await consultarSsw(CHAVE, fetchImpl);

    if (!r.ok) throw new Error("esperava sucesso");
    expect(r.ocorrencias[0].data?.toISOString()).toBe("2026-10-08T13:30:00.000Z");
    expect(r.ocorrencias[1].data).toBeNull();
  });

  it("previsão com data inválida vira null", async () => {
    const corpo = structuredClone(RESPOSTA_ENCONTRADA);
    corpo.documento.tracking[0].descricao = "Previsao de entrega: 31/02/26.";
    const { fetchImpl } = fetchQueDevolve(respostaJson(corpo));

    const r = await consultarSsw(CHAVE, fetchImpl);

    if (!r.ok) throw new Error("esperava sucesso");
    expect(r.previsaoEntrega).toBeNull();
  });

  it("encontrado sem nenhum evento: ok, encontrado, lista vazia", async () => {
    const corpo = structuredClone(RESPOSTA_ENCONTRADA);
    corpo.documento.tracking = [];
    const { fetchImpl } = fetchQueDevolve(respostaJson(corpo));

    const r = await consultarSsw(CHAVE, fetchImpl);

    expect(r).toMatchObject({ ok: true, encontrado: true, ocorrencias: [], previsaoEntrega: null });
  });
});

describe("consultarSsw: não encontrado e recusas", () => {
  it("'Nenhum documento localizado' vira ok com encontrado false", async () => {
    const { fetchImpl } = fetchQueDevolve(respostaJson(RESPOSTA_NAO_ENCONTRADA));

    const r = await consultarSsw(CHAVE, fetchImpl);

    expect(r).toMatchObject({
      ok: true,
      encontrado: false,
      ocorrencias: [],
      previsaoEntrega: null,
      transportadoraNome: null,
      bruto: RESPOSTA_NAO_ENCONTRADA,
    });
  });

  it("chave recusada pelo SSW (success false, outra mensagem) não é para tentar de novo", async () => {
    const { fetchImpl } = fetchQueDevolve(
      respostaJson({ success: false, message: "Modelo da chave da DANFE diferente de 55." }),
    );

    const r = await consultarSsw(CHAVE, fetchImpl);

    expect(r).toEqual({
      ok: false,
      erro: "Modelo da chave da DANFE diferente de 55.",
      tentarDeNovo: false,
    });
  });

  it("chave com dígito verificador errado (mensagem 'invalida') não é para tentar de novo", async () => {
    const { fetchImpl } = fetchQueDevolve(
      respostaJson({ success: false, message: "Chave da DANFE invalida." }),
    );

    const r = await consultarSsw(CHAVE, fetchImpl);

    expect(r).toMatchObject({ ok: false, tentarDeNovo: false });
  });
});

describe("consultarSsw: falhas transitórias", () => {
  it("HTTP 429 é para tentar de novo", async () => {
    const { fetchImpl } = fetchQueDevolve(new Response("", { status: 429 }));

    const r = await consultarSsw(CHAVE, fetchImpl);

    expect(r).toMatchObject({ ok: false, tentarDeNovo: true });
  });

  it("HTTP 503 é para tentar de novo", async () => {
    const { fetchImpl } = fetchQueDevolve(new Response("", { status: 503 }));

    const r = await consultarSsw(CHAVE, fetchImpl);

    expect(r).toMatchObject({ ok: false, tentarDeNovo: true });
  });

  it("HTTP 400 não é para tentar de novo", async () => {
    const { fetchImpl } = fetchQueDevolve(new Response("", { status: 400 }));

    const r = await consultarSsw(CHAVE, fetchImpl);

    expect(r).toMatchObject({ ok: false, tentarDeNovo: false });
  });

  it("erro de rede é para tentar de novo", async () => {
    const fetchImpl = (async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;

    const r = await consultarSsw(CHAVE, fetchImpl);

    expect(r).toEqual({ ok: false, erro: "Falha de conexão com a SSW.", tentarDeNovo: true });
  });

  it("sem resposta em 15 segundos aborta e é para tentar de novo", async () => {
    vi.useFakeTimers();
    const fetchImpl = ((_url: unknown, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(Object.assign(new Error("The operation was aborted."), { name: "AbortError" }));
        });
      })) as unknown as typeof fetch;

    const pendente = consultarSsw(CHAVE, fetchImpl);
    await vi.advanceTimersByTimeAsync(TIMEOUT_SSW_MS);
    const r = await pendente;

    expect(r).toEqual({
      ok: false,
      erro: "A SSW não respondeu em 15 segundos.",
      tentarDeNovo: true,
    });
  });
});

describe("consultarSsw: resposta malformada", () => {
  it("corpo que não é JSON (ex.: página HTML) não é para tentar de novo", async () => {
    const { fetchImpl } = fetchQueDevolve(
      new Response("<html><body>Manutencao</body></html>", { status: 200 }),
    );

    const r = await consultarSsw(CHAVE, fetchImpl);

    expect(r).toEqual({ ok: false, erro: "A SSW devolveu algo que não é JSON.", tentarDeNovo: false });
  });

  it("JSON sem o campo success booleano é formato inesperado", async () => {
    const { fetchImpl } = fetchQueDevolve(respostaJson({ documento: {} }));

    const r = await consultarSsw(CHAVE, fetchImpl);

    expect(r).toMatchObject({ ok: false, tentarDeNovo: false });
  });

  it("JSON que é lista, não objeto, é formato inesperado", async () => {
    const { fetchImpl } = fetchQueDevolve(respostaJson([1, 2, 3]));

    const r = await consultarSsw(CHAVE, fetchImpl);

    expect(r).toMatchObject({ ok: false, tentarDeNovo: false });
  });

  it("success true sem bloco documento/tracking é malformado", async () => {
    const { fetchImpl } = fetchQueDevolve(respostaJson({ success: true, message: "ok" }));

    const r = await consultarSsw(CHAVE, fetchImpl);

    expect(r).toMatchObject({ ok: false, tentarDeNovo: false });
  });
});

describe("linkPublicoSsw", () => {
  it("monta o link com CNPJ e número da nota só com dígitos", () => {
    expect(linkPublicoSsw("12.345.678/0001-90", "8480")).toBe(
      "https://ssw.inf.br/app/tracking/12345678000190/8480",
    );
  });

  it("sem CNPJ ou número lança erro", () => {
    expect(() => linkPublicoSsw("", "8480")).toThrow();
    expect(() => linkPublicoSsw("12345678000190", "")).toThrow();
  });
});
