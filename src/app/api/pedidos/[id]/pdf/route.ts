import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obterUsuarioLogado } from "@/lib/sessao";
import { buscarPedidoComPermissao } from "@/app/(app)/pedidos/queries";
import { urlAssinadaPdf } from "@/lib/storage";

/** Abre o PDF original do pedido por uma URL assinada de uma hora (o bucket é privado). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const usuario = await obterUsuarioLogado();
  if (!usuario) return NextResponse.json({ erro: "não autenticado" }, { status: 401 });

  const pedido = await buscarPedidoComPermissao(id, usuario);
  if (!pedido?.arquivoOrigemId) return NextResponse.json({ erro: "PDF não encontrado" }, { status: 404 });

  const arquivo = await prisma.arquivoImportado.findUnique({ where: { id: pedido.arquivoOrigemId } });
  const url = arquivo ? await urlAssinadaPdf(arquivo.caminhoStorage).catch(() => null) : null;
  if (!url) return NextResponse.json({ erro: "PDF indisponível" }, { status: 404 });

  return NextResponse.redirect(url);
}
