import { describe, it, expect, vi, afterEach } from "vitest";
import { NextRequest } from "next/server";
import ExcelJS from "exceljs";

const obterUsuarioLogadoMock = vi.fn();
vi.mock("@/lib/sessao", () => ({
  obterUsuarioLogado: () => obterUsuarioLogadoMock(),
}));

import { GET as getAuditoria } from "../auditoria/route";
import { GET as getCadastros } from "../cadastros/[tipo]/route";
import { GET as getRastreio } from "../rastreio/route";
import { GET as getAlertas } from "../alertas/route";

const OPERADOR = { id: "u", nome: "Op", perfil: "OPERADOR" as const, fabricasIds: ["nenhuma"] };
const ANALISTA = { id: "u", nome: "An", perfil: "ANALISTA" as const, fabricasIds: [] };
const ADMIN = { id: "u", nome: "Adm", perfil: "ADMIN" as const, fabricasIds: [] };
const tipo = (t: string) => ({ params: Promise.resolve({ tipo: t }) });

async function cabecalhos(resposta: Response) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await resposta.arrayBuffer());
  return (workbook.worksheets[0].getRow(1).values as string[]).filter(Boolean);
}

afterEach(() => obterUsuarioLogadoMock.mockReset());

describe("exportações XLSX (RF33) — sessão e perfil", () => {
  it("exigem sessão", async () => {
    obterUsuarioLogadoMock.mockResolvedValue(null);
    expect((await getRastreio()).status).toBe(401);
    expect((await getAlertas()).status).toBe(401);
    expect((await getAuditoria(new NextRequest("http://x/api/export/auditoria"))).status).toBe(401);
    expect((await getCadastros(new Request("http://x"), tipo("clientes"))).status).toBe(401);
  });

  it("auditoria é de ADMIN e ANALISTA; cadastros só de ADMIN", async () => {
    obterUsuarioLogadoMock.mockResolvedValue(OPERADOR);
    expect((await getAuditoria(new NextRequest("http://x/api/export/auditoria"))).status).toBe(403);
    expect((await getCadastros(new Request("http://x"), tipo("clientes"))).status).toBe(403);

    obterUsuarioLogadoMock.mockResolvedValue(ANALISTA);
    expect((await getAuditoria(new NextRequest("http://x/api/export/auditoria"))).status).toBe(200);
    expect((await getCadastros(new Request("http://x"), tipo("clientes"))).status).toBe(403);

    obterUsuarioLogadoMock.mockResolvedValue(ADMIN);
    expect(await cabecalhos(await getCadastros(new Request("http://x"), tipo("usuarios")))).toEqual([
      "Nome", "E-mail", "Perfil", "Fábricas", "Ativo",
    ]);
    expect((await getCadastros(new Request("http://x"), tipo("outro"))).status).toBe(404);
  });

  it("rastreio e alertas geram planilha para quem tem sessão", async () => {
    obterUsuarioLogadoMock.mockResolvedValue(OPERADOR);
    expect(await cabecalhos(await getRastreio())).toEqual(["NFe", "Emissão", "Chave de acesso", "Status", "Total da nota"]);
    expect(await cabecalhos(await getAlertas())).toEqual(["Tipo", "Alerta", "Detalhe", "O que fazer", "Dias", "Valor"]);
  });
});
