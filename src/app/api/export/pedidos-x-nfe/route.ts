import { NextRequest, NextResponse } from "next/server";
import { obterUsuarioLogado } from "@/lib/sessao";
import { buscarPedidosParaGap } from "@/app/(app)/pedidos-x-nfe/queries";
import { calcularGap, filtrarGap, totaisPorAno } from "@/domain/analise/gap";
import { gerarXlsx } from "@/domain/export/xlsx";

const CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export async function GET(request: NextRequest) {
  const usuario = await obterUsuarioLogado();
  if (!usuario) return NextResponse.json({ erro: "não autenticado" }, { status: 401 });

  const params = request.nextUrl.searchParams;
  const filtro = {
    fabrica: params.get("fabrica") ?? undefined,
    cliente: params.get("cliente") ?? undefined,
    ano: params.get("ano") ?? undefined,
    mes: params.get("mes") ?? undefined,
  };

  const linhas = filtrarGap(calcularGap(await buscarPedidosParaGap(usuario)), filtro);

  const buffer = await gerarXlsx(
    "Pedidos x NFe",
    ["Mês", "Fábrica", "Cliente", "Valor pedido", "Valor faturado", "Gap"],
    [
      ...linhas.map((l) => [l.mes, l.fabrica, l.cliente, l.valorPedido, l.valorFaturado, l.gap]),
      // RN21: total anual ao fim da planilha.
      ...totaisPorAno(linhas).map((t) => [`Total ${t.ano}`, "", "", t.valorPedido, t.valorFaturado, t.gap]),
    ],
  );

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": CONTENT_TYPE,
      "Content-Disposition": 'attachment; filename="pedidos-x-nfe.xlsx"',
    },
  });
}
