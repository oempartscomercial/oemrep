import ExcelJS from "exceljs";

export type CelulaXlsx = string | number;

// RF33: gera um XLSX de qualquer listagem (cabeçalhos + linhas). O chamador decide as
// colunas; esta função só monta a planilha e devolve os bytes.
export async function gerarXlsx(
  nomePlanilha: string,
  cabecalhos: string[],
  linhas: CelulaXlsx[][],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const planilha = workbook.addWorksheet(nomePlanilha);

  planilha.addRow(cabecalhos);
  planilha.getRow(1).font = { bold: true };

  for (const linha of linhas) {
    planilha.addRow(linha);
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer as ArrayBuffer);
}
