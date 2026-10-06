import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obterUsuarioLogado } from "@/lib/sessao";
import { podeAcessarFabrica } from "@/lib/authz";

export async function GET(request: NextRequest) {
  const usuario = await obterUsuarioLogado();
  if (!usuario) return NextResponse.json({ erro: "não autenticado" }, { status: 401 });

  const fabricaId = request.nextUrl.searchParams.get("fabricaId");
  if (!fabricaId) return NextResponse.json([]);
  if (!podeAcessarFabrica(usuario, fabricaId)) return NextResponse.json({ erro: "sem permissão" }, { status: 403 });

  const clientes = await prisma.cliente.findMany({
    where: { fabricas: { some: { fabricaId } } },
    select: { id: true, nomeFantasia: true },
    orderBy: { nomeFantasia: "asc" },
  });
  return NextResponse.json(clientes);
}
