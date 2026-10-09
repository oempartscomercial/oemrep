import { NextResponse, type NextRequest } from "next/server";
import { atualizarRastreiosEmAberto } from "@/lib/rastreio/atualizar";
import { abrirIssuesDeTransportadorasNovas } from "@/lib/rastreio/issue-transportadora";
import { segredoConfere, segredoDaRequisicao } from "@/lib/whatsapp/segredo";

// Cron diário de rastreio: consulta as transportadoras de todas as notas em trânsito e abre
// issue no GitHub para transportadora nova que não deu para rastrear. A Vercel chama com GET e
// `Authorization: Bearer <CRON_SECRET>` (vercel.json).
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const esperado = process.env.CRON_SECRET;
  if (!esperado) return NextResponse.json({ erro: "Cron não configurado." }, { status: 503 });
  if (!segredoConfere(segredoDaRequisicao(req), esperado)) {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }

  try {
    const rastreio = await atualizarRastreiosEmAberto();
    let issues: Awaited<ReturnType<typeof abrirIssuesDeTransportadorasNovas>> | { erro: string };
    try {
      issues = await abrirIssuesDeTransportadorasNovas();
    } catch (erro) {
      console.error("[cron] falha ao abrir issues de transportadora", erro);
      issues = { erro: "Falha ao falar com o GitHub." };
    }
    return NextResponse.json({ ok: true, rastreio, issues });
  } catch (erro) {
    console.error("[cron] falha no rastreio diário", erro);
    return NextResponse.json({ erro: "Falha no rastreio diário." }, { status: 500 });
  }
}
