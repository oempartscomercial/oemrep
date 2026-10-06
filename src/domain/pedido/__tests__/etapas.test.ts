import { describe, it, expect } from "vitest";
import { etapasDoPedido } from "../etapas";

const situacoes = (estado: Parameters<typeof etapasDoPedido>[0]) => etapasDoPedido(estado).map((e) => `${e.rotulo}:${e.situacao}`);

describe("etapasDoPedido (RF08)", () => {
  it("marca o que já passou, a etapa atual e o que falta", () => {
    expect(situacoes("SEM_NFE")).toEqual(["Sem NFe:atual", "Faturamento parcial:futura", "Completo:futura", "Arquivado:futura"]);
    expect(situacoes("PARCIAL")).toEqual(["Sem NFe:feita", "Faturamento parcial:atual", "Completo:futura", "Arquivado:futura"]);
    expect(situacoes("ARQUIVADO")).toEqual(["Sem NFe:feita", "Faturamento parcial:feita", "Completo:feita", "Arquivado:atual"]);
  });
});
