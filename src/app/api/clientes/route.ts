import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obterUsuarioLogado } from "@/lib/sessao";
import { podeAcessarFabrica } from "@/lib/authz";

export async function GET(request: NextRequest) {
  const usuario = await obterUsuarioLogado();
  if (!usuario) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  const fabricaId = request.nextUrl.searchParams.get("fabricaId");
  if (!fabricaId) return NextResponse.json([]);

  // ADR-009: a carteira de clientes de uma fábrica é sigilosa entre fábricas.
  if (!podeAcessarFabrica(usuario, fabricaId)) {
    return NextResponse.json({ erro: "Sem permissão para esta fábrica." }, { status: 403 });
  }

  const clientes = await prisma.cliente.findMany({
    where: { fabricas: { some: { fabricaId } } },
    select: { id: true, nomeFantasia: true },
    orderBy: { nomeFantasia: "asc" },
  });
  return NextResponse.json(clientes);
}
