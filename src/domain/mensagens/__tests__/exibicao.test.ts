import { describe, it, expect } from "vitest";
import { agruparPorDia, descreverMensagem, formatarHora, formatarNumero } from "../exibicao";

describe("descreverMensagem", () => {
  it("texto aparece como veio", () => {
    expect(descreverMensagem({ tipo: "TEXTO", texto: "Bom dia" })).toEqual({ aviso: null, texto: "Bom dia" });
  });
  it("áudio avisa que não há transcrição", () => {
    expect(descreverMensagem({ tipo: "AUDIO", texto: null })).toEqual({ aviso: "Áudio (ainda sem transcrição)", texto: null });
  });
  it("imagem, vídeo e documento mantêm a legenda", () => {
    expect(descreverMensagem({ tipo: "IMAGEM", texto: "Foto da peça" })).toEqual({ aviso: "Imagem", texto: "Foto da peça" });
    expect(descreverMensagem({ tipo: "VIDEO", texto: null })).toEqual({ aviso: "Vídeo", texto: null });
    expect(descreverMensagem({ tipo: "DOCUMENTO", texto: "pedido.pdf" })).toEqual({ aviso: "Documento", texto: "pedido.pdf" });
  });
  it("outro tipo não finge ser texto", () => {
    expect(descreverMensagem({ tipo: "OUTRO", texto: null })).toEqual({ aviso: "Mensagem de outro tipo (figurinha, localização…)", texto: null });
  });
});

describe("agruparPorDia (dia de São Paulo)", () => {
  it("agrupa em ordem cronológica e vira o dia à meia-noite do Brasil, não do UTC", () => {
    const m = (id: string, iso: string) => ({ id, ocorridoEm: new Date(iso) });
    const grupos = agruparPorDia([
      m("c", "2026-10-07T12:00:00Z"),
      m("a", "2026-10-06T14:00:00Z"),
      // 02:30 UTC de 07/10 ainda é 23:30 de 06/10 em São Paulo
      m("b", "2026-10-07T02:30:00Z"),
    ]);
    expect(grupos.map((g) => [g.dia, g.mensagens.map((x) => x.id)])).toEqual([
      ["2026-10-06", ["a", "b"]],
      ["2026-10-07", ["c"]],
    ]);
  });
  it("lista vazia dá nenhum grupo", () => {
    expect(agruparPorDia([])).toEqual([]);
  });
});

describe("formatação", () => {
  it("hora no fuso de São Paulo", () => {
    expect(formatarHora(new Date("2026-10-07T02:30:00Z"))).toBe("23:30");
  });
  it("número do Brasil com DDD, celular e fixo", () => {
    expect(formatarNumero("+5547999998888")).toBe("(47) 99999-8888");
    expect(formatarNumero("+554733334444")).toBe("(47) 3333-4444");
  });
  it("número de fora fica como está", () => {
    expect(formatarNumero("+14155550132")).toBe("+14155550132");
  });
});
