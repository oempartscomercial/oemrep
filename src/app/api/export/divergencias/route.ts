import { NextResponse } from "next/server";
import { obterUsuarioLogado } from "@/lib/sessao";
import { buscarChamadosPermitidos } from "@/app/(app)/divergencias/queries";
import { gerarXlsx } from "@/domain/export/xlsx";
import { filtrarFila, lerSituacaoFila } from "@/domain/chamado/fila";

const CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export async function GET(request: Request) {
  const usuario = await obterUsuarioLogado();
  if (!usuario) return NextResponse.json({ erro: "não autenticado" }, { status: 401 });

  const situacao = lerSituacaoFila(new URL(request.url).searchParams.get("situacao") ?? undefined);
  const chamados = filtrarFila(await buscarChamadosPermitidos(usuario), situacao);

  const buffer = await gerarXlsx(
    "Divergências",
    ["NFe", "Motivo", "Estado", "Crítico", "Última atualização"],
    chamados.map((c) => [
      c.notaFiscal.numero,
      c.motivo.nome,
      c.estado,
      c.critico ? "Sim" : "Não",
      c.ultimaAtualizacao.toLocaleDateString("pt-BR"),
    ]),
  );

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": CONTENT_TYPE,
      "Content-Disposition": 'attachment; filename="divergencias.xlsx"',
    },
  });
}
