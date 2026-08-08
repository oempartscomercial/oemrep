import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obterUsuarioLogado } from "@/lib/sessao";
import { filtroFabricasPermitidas } from "@/lib/authz";

export async function GET() {
  const usuario = await obterUsuarioLogado();
  if (!usuario) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  // ADR-009: o operador só enxerga as fábricas em que tem permissão. Sem isso ele via
  // "Autoflex" no seletor, escolhia, e só descobria no submit que não podia.
  const permitidas = filtroFabricasPermitidas(usuario);

  const fabricas = await prisma.fabrica.findMany({
    where: permitidas ? { id: { in: permitidas } } : undefined,
    select: { id: true, nome: true },
    orderBy: { nome: "asc" },
  });
  return NextResponse.json(fabricas);
}
