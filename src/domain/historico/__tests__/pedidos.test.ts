import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import { extrairTotaisPedidos } from "../pedidos";

// Recria a estrutura real inspecionada: linha 1 é um título mesclado, linha 2 é o
// cabeçalho real, dados a partir da linha 3. Colunas de resumo/fórmula à direita
// (F em diante) são ignoradas.
async function planilhaPedidos(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("OEM REP - PEDIDOS RECEBIDOS 26");
  ws.addRow(["ACOMPANHAMENTO 2026"]); // L1 título
  ws.addRow(["MÊS PEDIDO", "DIA PEDIDO", "FABRICANTE", "CLIENTE", "VR PEDIDO (S/IMP)"]); // L2 cabeçalho
  ws.addRow(["JANEIRO", new Date(Date.UTC(2026, 0, 10)), "AUTOFLEX", "ARAUTHO - TO", 1000]);
  ws.addRow(["JANEIRO", new Date(Date.UTC(2026, 0, 20)), "AUTOFLEX", "FEITOSA - MA", 500]);
  ws.addRow(["JANEIRO", new Date(Date.UTC(2026, 0, 25)), "BOWDEN", "DICAIXA - RS", 300]);
  ws.addRow(["FEVEREIRO", new Date(Date.UTC(2026, 1, 5)), "AUTOFLEX", "GIRAO", 700]);
  // uma segunda aba derivada (só fórmulas/resumo) deve ser ignorada
  const dash = wb.addWorksheet("DASHBOARD");
  dash.addRow(["DASHBOARD — PEDIDOS RECEBIDOS 2026"]);
  dash.addRow(["TOTAL GERAL (S/IMP)", "Nº PEDIDOS"]);
  dash.addRow([999999, 42]);
  const ab = await wb.xlsx.writeBuffer();
  return Buffer.from(ab);
}

describe("extrairTotaisPedidos", () => {
  it("agrupa e soma o valor de pedido por ano+mês+fabricante, derivando ano/mês da data", async () => {
    const totais = await extrairTotaisPedidos(await planilhaPedidos());

    expect(totais).toContainEqual({ ano: 2026, mes: 1, fabricaNome: "AUTOFLEX", valor: 1500 });
    expect(totais).toContainEqual({ ano: 2026, mes: 1, fabricaNome: "BOWDEN", valor: 300 });
    expect(totais).toContainEqual({ ano: 2026, mes: 2, fabricaNome: "AUTOFLEX", valor: 700 });
    expect(totais).toHaveLength(3);
  });

  it("ignora abas sem o cabeçalho de pedidos (ex.: DASHBOARD)", async () => {
    const totais = await extrairTotaisPedidos(await planilhaPedidos());
    // 999999 do DASHBOARD nunca entra em nenhum total
    expect(totais.some((t) => t.valor === 999999)).toBe(false);
  });

  it("lança erro quando nenhuma aba tem o cabeçalho esperado", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Qualquer");
    ws.addRow(["Coluna A", "Coluna B"]);
    const buffer = Buffer.from(await wb.xlsx.writeBuffer());
    await expect(extrairTotaisPedidos(buffer)).rejects.toThrow(/cabeçalho de pedidos/);
  });

  it("aceita a coluna DIA como serial numérico do Excel, agrupando no ano/mês certo", async () => {
    const serial = (Date.UTC(2026, 2, 15) - Date.UTC(1899, 11, 30)) / 86400000; // 15/Mar/2026
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("OEM REP - PEDIDOS RECEBIDOS 26");
    ws.addRow(["ACOMPANHAMENTO 2026"]);
    ws.addRow(["MÊS PEDIDO", "DIA PEDIDO", "FABRICANTE", "CLIENTE", "VR PEDIDO (S/IMP)"]);
    ws.addRow(["MARÇO", serial, "AUTOFLEX", "ARAUTHO - TO", 1234]);
    const buffer = Buffer.from(await wb.xlsx.writeBuffer());

    const totais = await extrairTotaisPedidos(buffer);
    expect(totais).toContainEqual({ ano: 2026, mes: 3, fabricaNome: "AUTOFLEX", valor: 1234 });
  });

  it("não trata como aba de pedidos um cabeçalho incompleto (sem DIA PEDIDO)", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("QUASE PEDIDOS");
    ws.addRow(["ACOMPANHAMENTO 2026"]);
    ws.addRow(["MÊS PEDIDO", "FABRICANTE", "CLIENTE", "VR PEDIDO (S/IMP)"]); // sem DIA PEDIDO
    ws.addRow(["JANEIRO", "AUTOFLEX", "ARAUTHO - TO", 555]);
    const buffer = Buffer.from(await wb.xlsx.writeBuffer());

    // matcher rejeita cabeçalho parcial → nenhuma aba de pedidos → erro
    await expect(extrairTotaisPedidos(buffer)).rejects.toThrow(/cabeçalho de pedidos/);
  });
});
