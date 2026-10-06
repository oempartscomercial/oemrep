import { NextResponse, type NextRequest } from "next/server";
import type { LinhaWhatsapp } from "@prisma/client";
import { registrarEvento } from "@/lib/whatsapp/registrar";
import { segredoConfere, segredoDaRequisicao } from "@/lib/whatsapp/segredo";

// Webhook do transporte de WhatsApp (ADR-015). Uma rota por linha, cada uma com o próprio
// segredo. Só a linha de prospecção existe nesta fase; a do assistente entra na fase 3.
const LINHAS: Record<string, { linha: LinhaWhatsapp; variavelDoSegredo: string }> = {
  prospeccao: { linha: "PROSPECCAO", variavelDoSegredo: "WHATSAPP_WEBHOOK_SEGREDO_PROSPECCAO" },
};

const LIMITE_DO_CORPO = 1_000_000;

export async function POST(req: NextRequest, { params }: { params: Promise<{ linha: string }> }) {
  const config = LINHAS[(await params).linha];
  if (!config) return NextResponse.json({ erro: "Linha desconhecida." }, { status: 404 });

  const esperado = process.env[config.variavelDoSegredo];
  if (!esperado) return NextResponse.json({ erro: "Webhook não configurado." }, { status: 503 });
  if (!segredoConfere(segredoDaRequisicao(req), esperado)) {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }

  const bruto = await req.text();
  if (bruto.length > LIMITE_DO_CORPO) return NextResponse.json({ erro: "Corpo grande demais." }, { status: 413 });
  let corpo: unknown;
  try {
    corpo = JSON.parse(bruto);
  } catch {
    return NextResponse.json({ erro: "Corpo não é JSON." }, { status: 400 });
  }

  try {
    const { eventoId } = await registrarEvento(config.linha, corpo);
    return NextResponse.json({ ok: true, eventoId });
  } catch (erro) {
    // O evento bruto já está gravado com o erro; responder 500 faz o transporte tentar de novo.
    console.error("[whatsapp] falha ao registrar evento", erro);
    return NextResponse.json({ erro: "Falha ao registrar o evento." }, { status: 500 });
  }
}
