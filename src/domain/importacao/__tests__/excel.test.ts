import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import { extrairItensDaPlanilha } from "../excel";

async function criarPlanilhaDeTeste(linhas: ExcelJS.CellValue[][]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const planilha = workbook.addWorksheet("Pedido");
  planilha.addRow(["Referência", "Descrição", "Quantidade", "Valor Unitário"]);
  linhas.forEach((linha) => planilha.addRow(linha));
  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

describe("extrairItensDaPlanilha", () => {
  it("extrai itens de uma planilha válida", async () => {
    const buffer = await criarPlanilhaDeTeste([
      ["REF-001", "Amortecedor dianteiro", 10, 125.5],
      ["REF-002", "Kit de embreagem", 2, 480],
    ]);

    const itens = await extrairItensDaPlanilha(buffer);

    expect(itens).toEqual([
      { referencia: "REF-001", descricao: "Amortecedor dianteiro", quantidade: 10, valorUnitario: 125.5 },
      { referencia: "REF-002", descricao: "Kit de embreagem", quantidade: 2, valorUnitario: 480 },
    ]);
  });

  it("ignora linhas sem referência", async () => {
    const buffer = await criarPlanilhaDeTeste([
      ["REF-001", "Amortecedor dianteiro", 10, 125.5],
      ["", "", "", ""],
    ]);

    const itens = await extrairItensDaPlanilha(buffer);
    expect(itens).toHaveLength(1);
  });

  it("rejeita quantidade não numérica apontando a linha", async () => {
    const buffer = await criarPlanilhaDeTeste([
      ["REF-001", "Amortecedor dianteiro", 10, 125.5],
      ["REF-002", "Kit de embreagem", "dez", 480],
    ]);

    await expect(extrairItensDaPlanilha(buffer)).rejects.toThrow(/linha 3 \(quantidade\)/);
  });

  it("rejeita valor unitário não numérico apontando a linha", async () => {
    const buffer = await criarPlanilhaDeTeste([
      ["REF-001", "Amortecedor dianteiro", 10, "a combinar"],
    ]);

    await expect(extrairItensDaPlanilha(buffer)).rejects.toThrow(/linha 2 \(valor unitário\)/);
  });

  it("aponta todas as linhas inválidas de uma vez", async () => {
    const buffer = await criarPlanilhaDeTeste([
      ["REF-001", "Amortecedor dianteiro", "dez", 125.5],
      ["REF-002", "Kit de embreagem", 2, 480],
      ["REF-003", "Pastilha de freio", 4, "a combinar"],
    ]);

    await expect(extrairItensDaPlanilha(buffer)).rejects.toThrow(
      "Valores inválidos na planilha: linha 2 (quantidade), linha 4 (valor unitário)",
    );
  });

  it("aceita célula de fórmula com resultado numérico", async () => {
    const buffer = await criarPlanilhaDeTeste([
      ["REF-001", "Amortecedor dianteiro", 10, { formula: "C2*2", result: 20 }],
    ]);

    const itens = await extrairItensDaPlanilha(buffer);

    expect(itens[0]?.valorUnitario).toBe(20);
  });

  it("trata célula numérica vazia como zero, sem virar NaN", async () => {
    const buffer = await criarPlanilhaDeTeste([["REF-001", "Amortecedor dianteiro", null, null]]);

    const itens = await extrairItensDaPlanilha(buffer);

    expect(itens).toEqual([
      { referencia: "REF-001", descricao: "Amortecedor dianteiro", quantidade: 0, valorUnitario: 0 },
    ]);
  });

  it("rejeita planilha sem as colunas esperadas", async () => {
    const workbook = new ExcelJS.Workbook();
    const planilha = workbook.addWorksheet("Pedido");
    planilha.addRow(["Coluna A", "Coluna B"]);
    const arrayBuffer = await workbook.xlsx.writeBuffer();
    const buffer = Buffer.from(arrayBuffer);

    await expect(extrairItensDaPlanilha(buffer)).rejects.toThrow(/Colunas não encontradas/);
  });
});
