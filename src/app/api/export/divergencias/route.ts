import { NextResponse } from "next/server";
import { obterUsuarioLogado } from "@/lib/sessao";
import { buscarChamadosPermitidos } from "@/app/(app)/divergencias/queries";
import { gerarXlsx } from "@/domain/export/xlsx";

const CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export async function GET() {
  const usuario = await obterUsuarioLogado();
  if (!usuario) return NextResponse.json({ erro: "não autenticado" }, { status: 401 });

  const chamados = await buscarChamadosPermitidos(usuario);

  const buffer = await gerarXlsx(
    "Divergências",
    ["NFe", "Motivo", "Estado", "Crítico"],
    chamados.map((c) => [c.notaFiscal.numero, c.motivo.nome, c.estado, c.critico ? "Sim" : "Não"]),
  );

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": CONTENT_TYPE,
      "Content-Disposition": 'attachment; filename="divergencias.xlsx"',
    },
  });
}
