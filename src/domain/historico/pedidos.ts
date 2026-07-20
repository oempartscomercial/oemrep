import ExcelJS from "exceljs";
import type { TotalMensal } from "./tipos";

function normalizar(texto: string): string {
  return texto
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

const COL = {
  dia: ["dia pedido"],
  fabricante: ["fabricante"],
  valor: ["vr pedido (s/imp)", "vr pedido", "valor"],
};

type Indices = { dia: number; fabricante: number; valor: number };

// Procura, nas primeiras 5 linhas de uma aba, a linha de cabeçalho que contém as
// colunas de pedido. Retorna os índices das colunas e o número da linha, ou null.
function localizarCabecalho(ws: ExcelJS.Worksheet): { indices: Indices; linha: number } | null {
  for (let n = 1; n <= 5; n++) {
    const row = ws.getRow(n);
    const achado: Partial<Indices> = {};
    row.eachCell((celula, col) => {
      const texto = normalizar(String(celula.value ?? ""));
      if (COL.dia.includes(texto)) achado.dia = col;
      if (COL.fabricante.includes(texto)) achado.fabricante = col;
      if (COL.valor.includes(texto)) achado.valor = col;
    });
    if (achado.dia && achado.fabricante && achado.valor) {
      return { indices: achado as Indices, linha: n };
    }
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

export async function extrairTotaisPedidos(buffer: Buffer): Promise<TotalMensal[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);

  let alvo: { ws: ExcelJS.Worksheet; indices: Indices; linha: number } | null = null;
  for (const ws of wb.worksheets) {
    const cab = localizarCabecalho(ws);
    if (cab) {
      alvo = { ws, indices: cab.indices, linha: cab.linha };
      break;
    }
  }
  if (!alvo) {
    throw new Error("Nenhuma aba com o cabeçalho de pedidos (MÊS PEDIDO / DIA PEDIDO / FABRICANTE / VR PEDIDO).");
  }

  const grupos = new Map<string, TotalMensal>();
  const { ws, indices, linha } = alvo;

  ws.eachRow((row, numero) => {
    if (numero <= linha) return;
    const data = comoData(row.getCell(indices.dia).value);
    const fabricaNome = String(row.getCell(indices.fabricante).value ?? "").trim();
    const valor = Number(row.getCell(indices.valor).value ?? 0);
    // Células cuja DIA não é uma data reconhecível são intencionalmente ignoradas.
    if (!data || !fabricaNome || !Number.isFinite(valor)) return;

    const ano = data.getUTCFullYear();
    const mes = data.getUTCMonth() + 1;
    const chave = `${ano}-${mes}-${fabricaNome}`;
    const atual = grupos.get(chave) ?? { ano, mes, fabricaNome, valor: 0 };
    atual.valor += valor;
    grupos.set(chave, atual);
  });

  return [...grupos.values()];
}
