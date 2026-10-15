import { describe, it, expect } from "vitest";
import { agruparPorDia, autoria, categoriaDoCanal, rotuloDoDia } from "../linha-do-tempo";

describe("categoriaDoCanal", () => {
  it("separa conversa de anotação", () => {
    expect(categoriaDoCanal("WHATSAPP")).toBe("conversa");
    expect(categoriaDoCanal("TELEFONE")).toBe("conversa");
    expect(categoriaDoCanal("REUNIAO")).toBe("conversa");
    expect(categoriaDoCanal("OUTRO")).toBe("anotacao");
    expect(categoriaDoCanal("PESQUISA")).toBe("anotacao");
  });
});

describe("rotuloDoDia", () => {
  it("hoje, ontem e o resto com dia da semana", () => {
    expect(rotuloDoDia("2026-10-14", "2026-10-14")).toBe("Hoje");
    expect(rotuloDoDia("2026-10-13", "2026-10-14")).toBe("Ontem");
    expect(rotuloDoDia("2026-10-12", "2026-10-14")).toBe("Segunda, 12/10/2026");
  });
});

describe("autoria", () => {
  it("diz quem gravou e se foi pelo Claude", () => {
    expect(autoria("USUARIO", "Rômulo")).toEqual({ quem: "Rômulo", peloClaude: false });
    expect(autoria("CLAUDE", "Arthur")).toEqual({ quem: "Arthur", peloClaude: true });
    expect(autoria("CLAUDE", null)).toEqual({ quem: "Claude", peloClaude: true });
    expect(autoria("AUTOMACAO", null)).toEqual({ quem: "Automação", peloClaude: false });
    expect(autoria("IMPORTACAO", null)).toEqual({ quem: "Importação", peloClaude: false });
  });
});

describe("agruparPorDia", () => {
  it("agrupa do mais recente para o mais antigo, mantendo a ordem dentro do dia", () => {
    const ev = (id: string, dia: string, quando: number) => ({ id, dia, quando });
    const grupos = agruparPorDia([ev("a", "2026-10-12", 1), ev("b", "2026-10-14", 3), ev("c", "2026-10-14", 5)]);
    expect(grupos.map((g) => [g.dia, g.eventos.map((e) => e.id)])).toEqual([
      ["2026-10-14", ["c", "b"]],
      ["2026-10-12", ["a"]],
    ]);
  });
});
