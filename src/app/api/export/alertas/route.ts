import { NextResponse } from "next/server";
import { obterUsuarioLogado } from "@/lib/sessao";
import { buscarAlertas } from "@/app/(app)/alertas/queries";
import { ROTULO_ALERTA } from "@/domain/alerta/fila";
import { gerarXlsx } from "@/domain/export/xlsx";
import { respostaXlsx } from "@/lib/resposta-xlsx";

export async function GET() {
  const usuario = await obterUsuarioLogado();
  if (!usuario) return NextResponse.json({ erro: "não autenticado" }, { status: 401 });

  const { alertas } = await buscarAlertas(usuario);
  const buffer = await gerarXlsx(
    "Alertas",
    ["Tipo", "Alerta", "Detalhe", "O que fazer", "Dias", "Valor"],
    alertas.map((a) => [ROTULO_ALERTA[a.tipo].titulo, a.titulo, a.detalhe, ROTULO_ALERTA[a.tipo].acao, a.dias, a.valor ?? ""]),
  );
  return respostaXlsx(buffer, "alertas.xlsx");
}
