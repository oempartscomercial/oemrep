import { describe, it, expect } from "vitest";
import { notaParada } from "../parada";

const AGORA = new Date("2026-10-09T12:00:00Z");
const dias = (n: number) => new Date(AGORA.getTime() - n * 24 * 60 * 60 * 1000);

describe("notaParada", () => {
  it("em trânsito sem ocorrência há 5 dias ou mais", () => {
    expect(notaParada({ status: "TRANSITO", ultimaOcorrenciaEm: dias(5), dataEmissao: dias(9) }, AGORA)).toBe(true);
    expect(notaParada({ status: "AGENDADO", ultimaOcorrenciaEm: dias(2), dataEmissao: dias(9) }, AGORA)).toBe(false);
  });
  it("sem nenhuma ocorrência conta da emissão", () => {
    expect(notaParada({ status: "TRANSITO", ultimaOcorrenciaEm: null, dataEmissao: dias(6) }, AGORA)).toBe(true);
    expect(notaParada({ status: "TRANSITO", ultimaOcorrenciaEm: null, dataEmissao: dias(1) }, AGORA)).toBe(false);
  });
  it("nota entregue nunca está parada", () => {
    expect(notaParada({ status: "RECEBIDA", ultimaOcorrenciaEm: dias(30), dataEmissao: dias(40) }, AGORA)).toBe(false);
  });
});
