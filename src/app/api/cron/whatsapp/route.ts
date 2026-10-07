import { NextResponse, type NextRequest } from "next/server";
import { enviarAprovadas } from "@/lib/whatsapp/enviar-aprovadas";
import { segredoConfere, segredoDaRequisicao } from "@/lib/whatsapp/segredo";

// Cron de envio agendado das mensagens APROVADAS que esperavam (ADR-015 §4). A Vercel chama com
// GET e envia `Authorization: Bearer <CRON_SECRET>` (ver vercel.json e .env.example).
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const esperado = process.env.CRON_SECRET;
  if (!esperado) return NextResponse.json({ erro: "Cron não configurado." }, { status: 503 });
  if (!segredoConfere(segredoDaRequisicao(req), esperado)) {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }

  try {
    const resumo = await enviarAprovadas();
    return NextResponse.json({ ok: true, ...resumo });
  } catch (erro) {
    console.error("[cron] falha no envio agendado do WhatsApp", erro);
    return NextResponse.json({ erro: "Falha no envio agendado." }, { status: 500 });
  }
}
