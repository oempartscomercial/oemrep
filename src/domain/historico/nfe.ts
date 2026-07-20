import ExcelJS from "exceljs";
import type { TotalMensal } from "./tipos";

function normalizar(texto: string): string {
  return texto
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

// Abas conhecidas que NÃO são fábricas (visão/resumo derivado). Qualquer outra aba é
// tratada como uma fábrica; se o nome não casar com uma Fabrica cadastrada, isso vira
// pendência bloqueante no import (resolverFabricas / Task 4) — nunca descarte silencioso.
export const ABAS_RESUMO_NFE = [
  "resumo geral",
  "dashboard",
  "clientes vendedor",
  "comissao backoffice",
];

const COL = {
  dia: ["dia"],
  valor: ["valor"],
};

type Indices = { dia: number; valor: number };

function localizarCabecalho(ws: ExcelJS.Worksheet): { indices: Indices; linha: number } | null {
  for (let n = 1; n <= 5; n++) {
    const row = ws.getRow(n);
    const achado: Partial<Indices> = {};
    row.eachCell((celula, col) => {
      const texto = normalizar(String(celula.value ?? ""));
      if (COL.dia.includes(texto)) achado.dia = col;
      if (COL.valor.includes(texto)) achado.valor = col;
    });
    if (achado.dia && achado.valor) return { indices: achado as Indices, linha: n };
  }
  return null;
}

function comoData(valor: unknown): Date | null {
  if (valor instanceof Date) return valor;
  if (typeof valor === "number" && Number.isFinite(valor) && valor > 0) {
    // Excel serial → Date (epoch 1899-12-30, cobre o bug do ano-1900). Base em UTC
    // para casar com getUTCFullYear/getUTCMonth usados no agrupamento.
    return new Date(Date.UTC(1899, 11, 30) + valor * 86400000);
  }
  return null;
}

export async function extrairTotaisNFe(buffer: Buffer): Promise<TotalMensal[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);

  const grupos = new Map<string, TotalMensal>();

  for (const ws of wb.worksheets) {
    if (ABAS_RESUMO_NFE.includes(normalizar(ws.name))) continue;
    const cab = localizarCabecalho(ws);
    if (!cab) continue;

    const fabricaNome = ws.name.trim();
    ws.eachRow((row, numero) => {
      if (numero <= cab.linha) return;
      const data = comoData(row.getCell(cab.indices.dia).value);
      const valor = Number(row.getCell(cab.indices.valor).value ?? 0);
      if (!data || !Number.isFinite(valor)) return;

      const ano = data.getUTCFullYear();
      const mes = data.getUTCMonth() + 1;
      const chave = `${ano}-${mes}-${fabricaNome}`;
      const atual = grupos.get(chave) ?? { ano, mes, fabricaNome, valor: 0 };
      atual.valor += valor;
      grupos.set(chave, atual);
    });
  }

  return [...grupos.values()];
}
