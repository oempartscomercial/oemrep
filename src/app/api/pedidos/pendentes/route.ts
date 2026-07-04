import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calcularQtdPendente } from "@/domain/pedido/item";

export async function GET(request: NextRequest) {
  const fabricaId = request.nextUrl.searchParams.get("fabricaId");
  const clienteId = request.nextUrl.searchParams.get("clienteId");
  if (!fabricaId || !clienteId) return NextResponse.json([]);

  const cliente = await prisma.cliente.findUnique({ where: { id: clienteId } });
  if (!cliente) return NextResponse.json([]);

  const pedidos = await prisma.pedido.findMany({
    where: { fabricaId, clienteId, estado: { in: ["SEM_NFE", "PARCIAL"] } },
    include: { itens: { where: { status: "PENDENTE" } } },
  });

  const pendencias = pedidos.flatMap((pedido) =>
    pedido.itens.map((item) => ({
      itemPedidoId: item.id,
      pedidoId: pedido.id,
      pedidoNumero: pedido.semNumero ? "S/N" : (pedido.numero ?? "S/N"),
      clienteCnpj: cliente.cnpj,
      referencia: item.referencia,
      quantidadePendente: calcularQtdPendente({
        quantidadePedida: item.quantidadePedida,
        quantidadeFaturada: item.quantidadeFaturada,
      }),
      valorUnitario: Number(item.valorUnitario),
    })),
  );

  return NextResponse.json(pendencias);
}
