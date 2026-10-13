/**
 * Importa os pedidos em aberto de uma planilha de acompanhamento (AUTOFLEX - COMPACTADA etc.).
 *
 *   npx tsx scripts/importar-acompanhamento.ts --arquivo "AUTOFLEX - COMPACTADA.xlsx" \
 *     --aba "COMPACTADA - PEDIDOS" --fabrica 35635942000120 --usuario email@x [--aplicar]
 *
 * Sem --aplicar só mostra o que faria. Usa o DATABASE_URL do ambiente.
 */
import ExcelJS from "exceljs";
import { PrismaClient } from "@prisma/client";
import { lerLinhasAcompanhamento } from "../src/domain/importacao/acompanhamento";
import { importarAcompanhamento } from "../src/lib/importacao-acompanhamento";

function argumento(nome: string): string | undefined {
  const i = process.argv.indexOf(`--${nome}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

// Célula do ExcelJS: fórmula vira o resultado; rich text vira texto.
function valor(c: ExcelJS.CellValue): unknown {
  if (c && typeof c === "object" && !(c instanceof Date)) {
    if ("result" in c) return c.result ?? null;
    if ("richText" in c) return c.richText.map((t) => t.text).join("");
    if ("text" in c) return c.text;
    return null;
  }
  return c;
}

async function main() {
  const arquivo = argumento("arquivo");
  const aba = argumento("aba");
  const cnpjFabrica = argumento("fabrica");
  const email = argumento("usuario");
  const aplicar = process.argv.includes("--aplicar");
  if (!arquivo || !aba || !cnpjFabrica || !email) throw new Error("Faltam --arquivo, --aba, --fabrica ou --usuario.");

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(arquivo);
  const ws = wb.getWorksheet(aba);
  if (!ws) throw new Error(`Aba "${aba}" não existe.`);
  const grade: unknown[][] = [];
  ws.eachRow({ includeEmpty: true }, (row) => {
    grade.push((row.values as ExcelJS.CellValue[]).slice(1).map(valor));
  });
  const { linhas, ignoradas } = lerLinhasAcompanhamento(grade);

  const prisma = new PrismaClient();
  try {
    const fabrica = await prisma.fabrica.findUnique({ where: { cnpj: cnpjFabrica.replace(/\D/g, "") } });
    if (!fabrica) throw new Error(`Fábrica com CNPJ ${cnpjFabrica} não cadastrada.`);
    const usuario = await prisma.usuario.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
    if (!usuario) throw new Error(`Usuário ${email} não existe.`);

    const resumo = await importarAcompanhamento(prisma, { fabricaId: fabrica.id, usuarioId: usuario.id, linhas, aplicar });
    console.log(JSON.stringify({ fabrica: fabrica.nome, aplicar, linhasLidas: linhas.length, linhasIgnoradas: ignoradas, ...resumo }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((erro) => {
  console.error(erro instanceof Error ? erro.message : erro);
  process.exit(1);
});
