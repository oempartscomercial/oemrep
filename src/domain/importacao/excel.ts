import ExcelJS from "exceljs";

export type ItemExtraido = {
  referencia: string;
  descricao: string;
  quantidade: number;
  valorUnitario: number;
};

const CABECALHOS: Record<keyof ItemExtraido, string[]> = {
  referencia: ["referencia", "ref"],
  descricao: ["descricao", "produto"],
  quantidade: ["quantidade", "qtd", "qtde"],
  valorUnitario: ["valor unitario", "vlr unit", "valor"],
};

function normalizar(texto: string): string {
  return texto
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function localizarColunas(linhaCabecalho: ExcelJS.Row): Record<keyof ItemExtraido, number> {
  const indices: Partial<Record<keyof ItemExtraido, number>> = {};

  linhaCabecalho.eachCell((celula, numeroColuna) => {
    const texto = normalizar(String(celula.value ?? ""));
    for (const campo of Object.keys(CABECALHOS) as (keyof ItemExtraido)[]) {
      if (CABECALHOS[campo].includes(texto)) indices[campo] = numeroColuna;
    }
  });

  const faltando = (Object.keys(CABECALHOS) as (keyof ItemExtraido)[]).filter(
    (campo) => !indices[campo],
  );
  if (faltando.length > 0) {
    throw new Error(`Colunas não encontradas na planilha: ${faltando.join(", ")}`);
  }
  return indices as Record<keyof ItemExtraido, number>;
}

export async function extrairItensDaPlanilha(buffer: Buffer): Promise<ItemExtraido[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);

  const planilha = workbook.worksheets[0];
  if (!planilha) return [];

  const colunas = localizarColunas(planilha.getRow(1));
  const itens: ItemExtraido[] = [];

  planilha.eachRow((linha, numeroLinha) => {
    if (numeroLinha === 1) return;

    const referencia = String(linha.getCell(colunas.referencia).value ?? "").trim();
    if (!referencia) return;

    itens.push({
      referencia,
      descricao: String(linha.getCell(colunas.descricao).value ?? "").trim(),
      quantidade: Number(linha.getCell(colunas.quantidade).value ?? 0),
      valorUnitario: Number(linha.getCell(colunas.valorUnitario).value ?? 0),
    });
  });

  return itens;
}
