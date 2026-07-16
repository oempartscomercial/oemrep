import { describe, it, expect } from "vitest";
import { prisma } from "../prisma";

const MOTIVOS_ESPERADOS = [
  "Itens errados",
  "Item faltando",
  "Item quebrado",
  "Acionar garantia",
  "NFe com valor errado",
  "Extravio",
];

describe("seed de motivos de divergência (RF26)", () => {
  it("contém os 6 motivos do PRD após o seed", async () => {
    const motivos = await prisma.motivoChamado.findMany({ where: { nome: { in: MOTIVOS_ESPERADOS } } });
    const nomes = motivos.map((m) => m.nome).sort();
    expect(nomes).toEqual([...MOTIVOS_ESPERADOS].sort());
  });
});
