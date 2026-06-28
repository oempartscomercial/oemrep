import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const fabricas = await prisma.fabrica.findMany({
    select: { id: true, nome: true },
    orderBy: { nome: "asc" },
  });
  return NextResponse.json(fabricas);
}
