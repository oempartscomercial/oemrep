import { NextResponse, type NextRequest } from "next/server";
import type { LinhaWhatsapp } from "@prisma/client";
import { registrarEvento } from "@/lib/whatsapp/registrar";
import { segredoConfere, segredoDaRequisicao } from "@/lib/whatsapp/segredo";
import { lerEvolution, segredosDoWebhook } from "@/lib/integracoes/config";

// Webhook do transporte de WhatsApp (ADR-015, ADR-019). Uma rota por linha. O segredo da linha de
// prospecção é o que a tela Integrações gerou ao configurar o webhook na Evolution; o da variável
// WHATSAPP_WEBHOOK_SEGREDO_PROSPECCAO continua valendo. A linha do assistente entra na fase 3.
const LINHAS: Record<string, LinhaWhatsapp> = { prospeccao: "PROSPECCAO" };

const LIMITE_DO_CORPO = 1_000_000;

// A Evolution pode ter outras instâncias (ou um webhook global): só vale a configurada na tela.
async function deOutraInstancia(corpo: unknown): Promise<boolean> {
  const instancia = (corpo as { instance?: unknown } | null)?.instance;
  if (typeof instancia !== "string" || !instancia) return false;
  try {
    const cfg = await lerEvolution();
    return cfg?.origem === "tela" && !!cfg.instancia && cfg.instancia !== instancia;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ linha: string }> }) {
  const linha = LINHAS[(await params).linha];
  if (!linha) return NextResponse.json({ erro: "Linha desconhecida." }, { status: 404 });

  const aceitos = await segredosDoWebhook();
  if (aceitos.length === 0) return NextResponse.json({ erro: "Webhook não configurado." }, { status: 503 });
  const recebido = segredoDaRequisicao(req);
  if (!aceitos.some((esperado) => segredoConfere(recebido, esperado))) {
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
  if (await deOutraInstancia(corpo)) return NextResponse.json({ ok: true, eventoId: null, ignorado: "outra instância" });

  try {
    const { eventoId } = await registrarEvento(linha, corpo);
    return NextResponse.json({ ok: true, eventoId });
  } catch (erro) {
    // O evento bruto já está gravado com o erro; responder 500 faz o transporte tentar de novo.
    console.error("[whatsapp] falha ao registrar evento", erro);
    return NextResponse.json({ erro: "Falha ao registrar o evento." }, { status: 500 });
  }
}
