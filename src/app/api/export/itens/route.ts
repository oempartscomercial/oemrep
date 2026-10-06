import { NextRequest, NextResponse } from "next/server";
import { obterUsuarioLogado } from "@/lib/sessao";
import { lerFiltroItens } from "@/domain/pedido/filtro-itens";
import { gerarXlsx } from "@/domain/export/xlsx";
import { buscarItens } from "@/app/(app)/pedidos/itens/queries";

const CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const LIMITE_EXPORTACAO = 50_000;

export async function GET(request: NextRequest) {
  const usuario = await obterUsuarioLogado();
  if (!usuario) return NextResponse.json({ erro: "não autenticado" }, { status: 401 });

  const filtro = { ...lerFiltroItens(Object.fromEntries(request.nextUrl.searchParams)), pagina: 1 };
  const { itens } = await buscarItens(usuario, filtro, LIMITE_EXPORTACAO);

  const buffer = await gerarXlsx(
    "Itens",
    ["Pedido", "Data do pedido", "Fábrica", "Cliente", "Referência", "Descrição", "Qtd. pedida", "Qtd. faturada", "Qtd. pendente", "Valor unitário", "Status"],
    itens.map((i) => [
      i.pedidoNumero,
      i.dataPedido.toLocaleDateString("pt-BR"),
      i.fabrica,
      i.cliente,
      i.referencia,
      i.descricao,
      i.quantidadePedida,
      i.quantidadeFaturada,
      i.quantidadePendente,
      i.valorUnitario,
      i.status,
    ]),
  );

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: { "Content-Type": CONTENT_TYPE, "Content-Disposition": 'attachment; filename="itens.xlsx"' },
  });
}
