/**
 * Carrega em produção a base da pasta do Rômulo (rep/dados: contas, contatos, interações,
 * pedidos de 2026) e os clientes das planilhas de acompanhamento do Zé.
 *
 *   npx tsx scripts/carregar-base-rep.ts --rep ~/Documents/Dev/Outros/rep/dados \
 *     --planilhas <pasta com os .xlsx> --usuario email@x [--prazo-padrao 2026-10-14] [--aplicar]
 *
 * --prazo-padrao é a data dada ao próximo passo que veio sem prazo (padrão: hoje).
 *
 * Sem --aplicar, simula e desfaz. Usa o DATABASE_URL do ambiente.
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import { PrismaClient } from "@prisma/client";
import { lerCsv } from "../src/domain/crm/importacao-rep";
import { clientesDaGrade, fabricaDoArquivo, juntarClientes } from "../src/domain/crm/carga-rep";
import { carregarBaseRep } from "../src/lib/carga-base-rep";

function argumento(nome: string): string | undefined {
  const i = process.argv.indexOf(`--${nome}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

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
  const rep = argumento("rep");
  const planilhas = argumento("planilhas");
  const email = argumento("usuario");
  const aplicar = process.argv.includes("--aplicar");
  const prazoPadrao = argumento("prazo-padrao") ?? new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
  if (!rep || !planilhas || !email) throw new Error("Faltam --rep, --planilhas ou --usuario.");

  const csv = (arquivo: string) => lerCsv(readFileSync(path.join(rep, arquivo), "utf8"));

  const listas = [];
  for (const arquivo of readdirSync(planilhas).filter((f) => f.endsWith(".xlsx"))) {
    const fabrica = fabricaDoArquivo(arquivo);
    if (!fabrica) continue;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(path.join(planilhas, arquivo));
    for (const ws of wb.worksheets) {
      const grade: unknown[][] = [];
      ws.eachRow({ includeEmpty: true }, (row) => grade.push((row.values as ExcelJS.CellValue[]).slice(1).map(valor)));
      listas.push(clientesDaGrade(grade, fabrica));
    }
  }
  const clientesPlanilha = juntarClientes(listas);

  const prisma = new PrismaClient();
  try {
    const usuario = await prisma.usuario.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
    if (!usuario) throw new Error(`Usuário ${email} não existe.`);
    const resumo = await carregarBaseRep(
      prisma,
      { contas: csv("contas.csv"), contatos: csv("contatos.csv"), interacoes: csv("interacoes.csv"), pedidos: csv("pedidos.csv"), clientesPlanilha },
      { aplicar, responsavelPadraoId: usuario.id, prazoPadrao },
    );
    console.log(JSON.stringify({ aplicar, prazoPadrao, clientesNasPlanilhas: clientesPlanilha.length, ...resumo }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((erro) => {
  console.error(erro instanceof Error ? erro.message : erro);
  process.exit(1);
});
