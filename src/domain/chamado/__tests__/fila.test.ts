import { describe, it, expect } from "vitest";
import { filtrarFila, lerSituacaoFila, resumirFila } from "../fila";

const chamados = [
  { id: "a", estado: "ABERTO", critico: true },
  { id: "b", estado: "AGUARDANDO", critico: false },
  { id: "c", estado: "EM_TRATATIVA", critico: false },
  { id: "d", estado: "RESOLVIDO", critico: false },
];

describe("fila de divergências", () => {
  it("abre em Abertos e ignora valor desconhecido", () => {
    expect(lerSituacaoFila(undefined)).toBe("ABERTOS");
    expect(lerSituacaoFila("qualquer")).toBe("ABERTOS");
    expect(lerSituacaoFila(["RESOLVIDOS"])).toBe("RESOLVIDOS");
  });

  it("separa abertos de resolvidos", () => {
    expect(filtrarFila(chamados, "ABERTOS").map((c) => c.id)).toEqual(["a", "b", "c"]);
    expect(filtrarFila(chamados, "RESOLVIDOS").map((c) => c.id)).toEqual(["d"]);
    expect(filtrarFila(chamados, "TODOS")).toHaveLength(4);
  });

  it("resume a fila para os indicadores", () => {
    expect(resumirFila(chamados)).toEqual({ abertos: 3, criticos: 1, aguardando: 1, resolvidos: 1 });
  });
});
