import { NextResponse } from "next/server";
import { obterUsuarioLogado } from "@/lib/sessao";
import { buscarPedidosParaAlerta } from "@/app/(app)/alertas/queries";
import { pedidosSemNfeVencidos } from "@/domain/alerta/semNfe";
import { obterParametroNumero } from "@/lib/parametros";
import { gerarXlsx } from "@/domain/export/xlsx";
import { respostaXlsx } from "@/lib/resposta-xlsx";

export async function GET() {
  const usuario = await obterUsuarioLogado();
  if (!usuario) return NextResponse.json({ erro: "não autenticado" }, { status: 401 });

  const prazoDias = await obterParametroNumero("prazo_alerta_sem_nfe_dias", 7);
  const vencidos = pedidosSemNfeVencidos(await buscarPedidosParaAlerta(usuario), new Date(), prazoDias);
  const buffer = await gerarXlsx(
    "Alertas",
    ["Pedido", "Fábrica", "Cliente", "Dias sem NFe"],
    vencidos.map((a) => [a.numero, a.fabrica, a.cliente, a.diasSemNfe]),
  );
  return respostaXlsx(buffer, "alertas.xlsx");
}
