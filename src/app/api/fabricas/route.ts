import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obterUsuarioLogado } from "@/lib/sessao";
import { filtroFabricasPermitidas } from "@/lib/authz";

// Fábricas para os formulários: só as que o usuário pode acessar (ADR-009).
export async function GET() {
  const usuario = await obterUsuarioLogado();
  if (!usuario) return NextResponse.json({ erro: "não autenticado" }, { status: 401 });

  const permitidas = filtroFabricasPermitidas(usuario);
  const fabricas = await prisma.fabrica.findMany({
    where: permitidas ? { id: { in: permitidas } } : {},
    select: { id: true, nome: true },
    orderBy: { nome: "asc" },
  });
  return NextResponse.json(fabricas);
}
