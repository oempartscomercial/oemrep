import { describe, it, expect } from "vitest";
import { acharFabricaPorNome, alertaRegiaoRudolph, lerFabricaDoFunil } from "../fabrica-prospeccao";

const FABRICAS = [
  { id: "f1", nome: "Autoflex" },
  { id: "f2", nome: "Bowden" },
  { id: "f3", nome: "Seineca/H3" },
  { id: "f4", nome: "Rudolph" },
];

describe("acharFabricaPorNome", () => {
  it("acha pelo nome sem ligar para maiúscula, acento ou espaço", () => {
    expect(acharFabricaPorNome("  rudolph ", FABRICAS)).toEqual({ ok: true, valor: FABRICAS[3] });
    expect(acharFabricaPorNome("BOWDEN", FABRICAS)).toEqual({ ok: true, valor: FABRICAS[1] });
  });

  it("acha pela parte do nome composto (Seineca ou H3)", () => {
    expect(acharFabricaPorNome("seineca", FABRICAS)).toEqual({ ok: true, valor: FABRICAS[2] });
    expect(acharFabricaPorNome("h3", FABRICAS)).toEqual({ ok: true, valor: FABRICAS[2] });
  });

  it("aceita o id", () => {
    expect(acharFabricaPorNome("f1", FABRICAS)).toEqual({ ok: true, valor: FABRICAS[0] });
  });

  it("nome desconhecido devolve a lista das fábricas, sem chutar", () => {
    const r = acharFabricaPorNome("Bosch", FABRICAS);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.mensagem).toBe('Fábrica "Bosch" não existe. Fábricas: Autoflex, Bowden, Seineca/H3, Rudolph.');
  });

  it("mais de uma fábrica com o pedaço: pergunta qual", () => {
    const r = acharFabricaPorNome("o", [{ id: "a", nome: "Bowden" }, { id: "b", nome: "Corven" }]);
    expect(r.ok).toBe(false);
  });
});

describe("lerFabricaDoFunil", () => {
  it("id de fábrica ativa vale; 'sem' vale; o resto vira todas", () => {
    expect(lerFabricaDoFunil("f4", FABRICAS)).toBe("f4");
    expect(lerFabricaDoFunil("sem", FABRICAS)).toBe("sem");
    expect(lerFabricaDoFunil("todas", FABRICAS)).toBe("todas");
    expect(lerFabricaDoFunil(undefined, FABRICAS)).toBe("todas");
    expect(lerFabricaDoFunil("fabrica-apagada", FABRICAS)).toBe("todas");
  });
});

describe("alertaRegiaoRudolph", () => {
  it("só alerta fora do Norte/Nordeste quando a prospecção é Rudolph ou ainda não tem fábrica", () => {
    expect(alertaRegiaoRudolph("SP", ["Rudolph"])).toBe(true);
    expect(alertaRegiaoRudolph("SP", [])).toBe(true);
    expect(alertaRegiaoRudolph("SP", ["Bowden"])).toBe(false);
    expect(alertaRegiaoRudolph("PE", ["Rudolph"])).toBe(false);
    expect(alertaRegiaoRudolph(null, ["Rudolph"])).toBe(false);
    expect(alertaRegiaoRudolph("GO", ["Bowden", "Rudolph Transmissões"])).toBe(true);
  });
});
