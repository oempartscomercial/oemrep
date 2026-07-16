import { NextRequest, NextResponse } from "next/server";
import { obterUsuarioLogado } from "@/lib/sessao";
import { buscarPedidosParaGap } from "@/app/(app)/pedidos-x-nfe/queries";
import { calcularGap } from "@/domain/analise/gap";
import { gerarXlsx } from "@/domain/export/xlsx";

const CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export async function GET(request: NextRequest) {
  const usuario = await obterUsuarioLogado();
  if (!usuario) return NextResponse.json({ erro: "não autenticado" }, { status: 401 });

  const fabrica = request.nextUrl.searchParams.get("fabrica") ?? "";
  const cliente = request.nextUrl.searchParams.get("cliente") ?? "";
  const mes = request.nextUrl.searchParams.get("mes") ?? "";

  const linhas = calcularGap(await buscarPedidosParaGap(usuario)).filter(
    (l) => (!fabrica || l.fabrica === fabrica) && (!cliente || l.cliente === cliente) && (!mes || l.mes === mes),
  );

  const buffer = await gerarXlsx(
    "Pedidos x NFe",
    ["Mês", "Fábrica", "Cliente", "Valor pedido", "Valor faturado", "Gap"],
    linhas.map((l) => [l.mes, l.fabrica, l.cliente, l.valorPedido, l.valorFaturado, l.gap]),
  );

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": CONTENT_TYPE,
      "Content-Disposition": 'attachment; filename="pedidos-x-nfe.xlsx"',
    },
  });
}
