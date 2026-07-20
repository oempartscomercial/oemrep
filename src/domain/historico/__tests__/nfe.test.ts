import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import { extrairTotaisNFe } from "../nfe";

// Estrutura real: uma aba por fábrica; L1 título mesclado, L2 cabeçalho
// (DIA / MÊS / VALOR / NFE / CLIENTE), dados a partir de L3. Abas de resumo
// (RESUMO GERAL etc.) são ignoradas pela allowlist.
async function planilhaNfe(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  for (const fab of ["AUTOFLEX", "BOWDEN"]) {
    const ws = wb.addWorksheet(fab);
    ws.addRow(["NOTAS EMITIDAS - 2026"]);
    ws.addRow(["DIA", "MÊS", "VALOR", "NFE", "CLIENTE"]);
    ws.addRow([new Date(Date.UTC(2026, 1, 2)), "FEVEREIRO", 100, 6488, ""]);
    ws.addRow([new Date(Date.UTC(2026, 1, 10)), "FEVEREIRO", 50, 6530, "GIRAO"]);
    ws.addRow([new Date(Date.UTC(2026, 2, 3)), "MARÇO", 200, 6600, ""]);
  }
  const resumo = wb.addWorksheet("RESUMO GERAL");
  resumo.addRow(["qualquer", "coisa"]);
  resumo.addRow([888888, 1]);
  const ab = await wb.xlsx.writeBuffer();
  return Buffer.from(ab);
}

describe("extrairTotaisNFe", () => {
  it("soma o valor por ano+mês usando o nome da aba como fábrica", async () => {
    const totais = await extrairTotaisNFe(await planilhaNfe());
    expect(totais).toContainEqual({ ano: 2026, mes: 2, fabricaNome: "AUTOFLEX", valor: 150 });
    expect(totais).toContainEqual({ ano: 2026, mes: 3, fabricaNome: "AUTOFLEX", valor: 200 });
    expect(totais).toContainEqual({ ano: 2026, mes: 2, fabricaNome: "BOWDEN", valor: 150 });
    expect(totais).toContainEqual({ ano: 2026, mes: 3, fabricaNome: "BOWDEN", valor: 200 });
  });

  it("ignora abas de resumo da allowlist (ex.: RESUMO GERAL)", async () => {
    const totais = await extrairTotaisNFe(await planilhaNfe());
    expect(totais.some((t) => t.fabricaNome === "RESUMO GERAL")).toBe(false);
    expect(totais.some((t) => t.valor === 888888)).toBe(false);
  });
});
