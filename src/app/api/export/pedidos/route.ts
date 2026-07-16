import { NextRequest, NextResponse } from "next/server";
import { obterUsuarioLogado } from "@/lib/sessao";
import { buscarPedidosPermitidos } from "@/app/(app)/pedidos/queries";
import { filtrarPedidos, type FiltroPedido } from "@/domain/pedido/filtro";
import { gerarXlsx } from "@/domain/export/xlsx";

const CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const FILTROS_VALIDOS: FiltroPedido[] = ["EM_ANDAMENTO", "CONCLUIDOS", "ARQUIVADOS", "TODOS"];

export async function GET(request: NextRequest) {
  const usuario = await obterUsuarioLogado();
  if (!usuario) return NextResponse.json({ erro: "não autenticado" }, { status: 401 });

  const filtroBruto = request.nextUrl.searchParams.get("filtro");
  const filtro: FiltroPedido =
    filtroBruto && (FILTROS_VALIDOS as string[]).includes(filtroBruto) ? (filtroBruto as FiltroPedido) : "TODOS";

  const pedidos = filtrarPedidos(await buscarPedidosPermitidos(usuario), filtro);

  const buffer = await gerarXlsx(
    "Pedidos",
    ["Número", "Fábrica", "Cliente", "Itens", "Estado"],
    pedidos.map((p) => [
      p.semNumero ? "S/N" : (p.numero ?? "—"),
      p.fabrica.nome,
      p.cliente.nomeFantasia,
      p.itens.length,
      p.estado,
    ]),
  );

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": CONTENT_TYPE,
      "Content-Disposition": 'attachment; filename="pedidos.xlsx"',
    },
  });
}
