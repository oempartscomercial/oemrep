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

// Converte o conteúdo de uma célula em número. Célula vazia vira 0 (a validação do
// pedido rejeita depois, com mensagem própria); célula de fórmula usa o resultado
// calculado; texto não numérico devolve null para ser reportado com o número da
// linha, em vez de virar NaN silencioso — NaN passava pela validação e só quebrava
// na gravação.
function comoNumero(valor: ExcelJS.CellValue): number | null {
  if (valor === null || valor === undefined) return 0;
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : null;
  if (typeof valor === "object" && "result" in valor) {
    return comoNumero(valor.result as ExcelJS.CellValue);
  }
  const texto = String(valor).trim();
  if (!texto) return 0;
  const numero = Number(texto);
  return Number.isFinite(numero) ? numero : null;
}

export async function extrairItensDaPlanilha(buffer: Buffer): Promise<ItemExtraido[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);

  const planilha = workbook.worksheets[0];
  if (!planilha) return [];

  const colunas = localizarColunas(planilha.getRow(1));
  const itens: ItemExtraido[] = [];
  const invalidas: string[] = [];

  planilha.eachRow((linha, numeroLinha) => {
    if (numeroLinha === 1) return;

    const referencia = String(linha.getCell(colunas.referencia).value ?? "").trim();
    if (!referencia) return;

    const quantidade = comoNumero(linha.getCell(colunas.quantidade).value);
    const valorUnitario = comoNumero(linha.getCell(colunas.valorUnitario).value);
    if (quantidade === null) invalidas.push(`linha ${numeroLinha} (quantidade)`);
    if (valorUnitario === null) invalidas.push(`linha ${numeroLinha} (valor unitário)`);
    if (quantidade === null || valorUnitario === null) return;

    itens.push({
      referencia,
      descricao: String(linha.getCell(colunas.descricao).value ?? "").trim(),
      quantidade,
      valorUnitario,
    });
  });

  if (invalidas.length > 0) {
    throw new Error(`Valores inválidos na planilha: ${invalidas.join(", ")}`);
  }

  return itens;
}
