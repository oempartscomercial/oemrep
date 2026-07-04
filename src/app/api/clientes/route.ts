import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const fabricaId = request.nextUrl.searchParams.get("fabricaId");
  if (!fabricaId) return NextResponse.json([]);

  const clientes = await prisma.cliente.findMany({
    where: { fabricas: { some: { fabricaId } } },
    select: { id: true, nomeFantasia: true },
    orderBy: { nomeFantasia: "asc" },
  });
  return NextResponse.json(clientes);
}
