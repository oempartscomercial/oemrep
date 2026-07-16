import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import { gerarXlsx } from "../xlsx";

describe("gerarXlsx (RF33)", () => {
  it("gera uma planilha com o nome, o cabeçalho e as linhas informadas", async () => {
    const buffer = await gerarXlsx(
      "Pedidos",
      ["Número", "Valor"],
      [
        ["PED-1", 100],
        ["PED-2", 250],
      ],
    );

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    const ws = wb.worksheets[0];

    expect(ws.name).toBe("Pedidos");
    expect(ws.getRow(1).getCell(1).value).toBe("Número");
    expect(ws.getRow(1).getCell(2).value).toBe("Valor");
    expect(ws.getRow(2).getCell(1).value).toBe("PED-1");
    expect(ws.getRow(2).getCell(2).value).toBe(100);
    expect(ws.getRow(3).getCell(1).value).toBe("PED-2");
    expect(ws.getRow(3).getCell(2).value).toBe(250);
  });

  it("gera só o cabeçalho quando não há linhas", async () => {
    const buffer = await gerarXlsx("Vazio", ["A", "B"], []);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    const ws = wb.worksheets[0];
    expect(ws.getRow(1).getCell(1).value).toBe("A");
    expect(ws.actualRowCount).toBe(1);
  });
});
