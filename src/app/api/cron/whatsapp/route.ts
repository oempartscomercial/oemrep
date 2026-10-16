import { NextResponse, type NextRequest } from "next/server";
import { enviarAprovadas, TRAVA_DO_ENVIO } from "@/lib/whatsapp/enviar-aprovadas";
import { segredoConfere, segredoDaRequisicao } from "@/lib/whatsapp/segredo";
import { comTrava } from "@/lib/trava";

// Envio das mensagens APROVADAS que já podem sair (ADR-015 §4, ADR-019): as que esperavam e as
// agendadas cuja hora chegou. Protegido por `Authorization: Bearer <CRON_SECRET>`. Pensado para ser
// chamado a cada 5 minutos por um agendador externo (pg_cron + pg_net no Supabase, SQL no ADR-019) e
// uma vez por dia pela Vercel (vercel.json), como rede de segurança. Idempotente: com outra execução
// em andamento, responde 200 sem fazer nada; e cada mensagem é reservada antes de sair.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Mais que o maxDuration: se a função morrer no meio, a trava vence sozinha logo depois.
const DURACAO_DA_TRAVA_MS = 2 * 60_000;

async function executar(req: NextRequest) {
  const esperado = process.env.CRON_SECRET;
  if (!esperado) return NextResponse.json({ erro: "Cron não configurado." }, { status: 503 });
  if (!segredoConfere(segredoDaRequisicao(req), esperado)) {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }

  try {
    const r = await comTrava(TRAVA_DO_ENVIO, DURACAO_DA_TRAVA_MS, () => enviarAprovadas());
    if (!r.executou) return NextResponse.json({ ok: true, ignorado: "Outra execução está em andamento." });
    return NextResponse.json({ ok: true, ...r.resultado });
  } catch (erro) {
    console.error("[cron] falha no envio agendado do WhatsApp", erro);
    return NextResponse.json({ erro: "Falha no envio agendado." }, { status: 500 });
  }
}

// A Vercel chama com GET; o pg_net do Supabase pode chamar com GET ou POST.
export const GET = executar;
export const POST = executar;
