import { describe, it, expect } from "vitest";
import { separarAgenda } from "../agenda";

describe("separarAgenda", () => {
  const hoje = "2026-10-14"; // quarta
  const p = (id: string, prazo: string) => ({ id, prazo });

  it("separa atrasados, de hoje, próximos 7 dias e o resto, cada grupo em ordem de prazo", () => {
    const r = separarAgenda([p("d", "2026-10-30"), p("s2", "2026-10-21"), p("a2", "2026-10-13"), p("h", "2026-10-14"), p("a1", "2026-10-01"), p("s1", "2026-10-15")], hoje);
    expect(r.atrasados.map((x) => x.id)).toEqual(["a1", "a2"]);
    expect(r.hoje.map((x) => x.id)).toEqual(["h"]);
    expect(r.proximos7.map((x) => x.id)).toEqual(["s1", "s2"]);
    expect(r.depois.map((x) => x.id)).toEqual(["d"]);
  });
});
