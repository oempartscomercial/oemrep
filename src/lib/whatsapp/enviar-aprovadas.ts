import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { despachar } from "./despachar";
import { obterTransporte, type TransporteWhatsapp } from "./transporte";

// Envio agendado (ADR-015 §4): reenvia as mensagens APROVADAS que ficaram esperando (fora do
// horário, linha caída, limite do dia). Chamado pelo cron diário (src/app/api/cron/whatsapp).
// Não decide regra de envio: cada mensagem passa por despachar(), que reaplica as proteções.
// Aqui só se escolhe a ordem, o ritmo, quando parar e quando cancelar por idade.

const IDADE_MAXIMA_MS = 7 * 86_400_000;
const LOTE_PADRAO = 10;
export const MOTIVO_APROVACAO_VENCIDA = "Aprovada há mais de 7 dias sem conseguir enviar.";

// despachar() devolve só o texto do motivo, sem o código do bloqueio. Por isso a parada é
// reconhecida pelo texto de verificarEnvio (src/domain/mensagens/envio.ts); os testes de
// enviar-aprovadas.test.ts travam essas duas frases.
const LINHA_FORA = /WhatsApp de prospecção não está conectado|Não consegui confirmar que o WhatsApp de prospecção/;
const LIMITE_DO_DIA = /Limite de \d+ primeiros contatos por dia/;

export type ResumoDoEnvioAgendado = {
  enviadas: number;
  /** Continuam APROVADAS depois da execução. */
  aguardando: number;
  canceladas: number;
  /** Por que o lote parou antes de esgotar as aprovadas. */
  paradasPor?: string;
};

function paradaDoBloqueio(motivo: string | undefined): string | undefined {
  if (motivo && LINHA_FORA.test(motivo)) return "WhatsApp de prospecção desconectado: as mensagens continuam aprovadas.";
  if (motivo && LIMITE_DO_DIA.test(motivo)) return "Limite diário de primeiros contatos atingido.";
  return undefined;
}

export async function enviarAprovadas(
  opcoes: { agora?: Date; transporte?: TransporteWhatsapp; limite?: number; mensagemIds?: string[] } = {},
): Promise<ResumoDoEnvioAgendado> {
  const agora = opcoes.agora ?? new Date();
  const transporte = opcoes.transporte ?? obterTransporte();
  // Máximo de despachos por execução. Cancelamentos por idade não contam.
  const limite = opcoes.limite ?? LOTE_PADRAO;
  // mensagemIds restringe o lote (testes e reenvio pontual); o cron não passa.
  const escopo: Prisma.MensagemWhereInput = {
    direcao: "SAIDA",
    status: "APROVADA",
    ...(opcoes.mensagemIds ? { id: { in: opcoes.mensagemIds } } : {}),
  };
  const corte = agora.getTime() - IDADE_MAXIMA_MS;

  // Mais antigas primeiro. Um despacho por vez: o limite diário conta o que já saiu.
  const aprovadas = await prisma.mensagem.findMany({ where: escopo, orderBy: { aprovadaEm: "asc" }, select: { id: true, aprovadaEm: true } });

  let enviadas = 0;
  let canceladas = 0;
  let despachos = 0;
  let paradasPor: string | undefined;

  for (const m of aprovadas) {
    // Vencida: cancela sem tocar no transporte, mesmo se a linha estiver caída. Não fica
    // esperando para sempre.
    if (m.aprovadaEm && m.aprovadaEm.getTime() < corte) {
      const cancelada = await prisma.mensagem.updateMany({
        where: { id: m.id, status: "APROVADA" },
        data: { status: "CANCELADA", motivoBloqueio: MOTIVO_APROVACAO_VENCIDA },
      });
      canceladas += cancelada.count;
      continue;
    }
    if (paradasPor || despachos >= limite) continue;

    despachos += 1;
    const resultado = await despachar(m.id, { transporte, agora });
    if (resultado.status === "ENVIADA") enviadas += 1;
    else if (resultado.status === "CANCELADA") canceladas += 1;
    else if (resultado.status === "FALHOU") paradasPor = `Falha no envio: ${resultado.motivo ?? "sem detalhe"}`;
    else if (resultado.status === "APROVADA") paradasPor = paradaDoBloqueio(resultado.motivo);
    // IGNORADA: outro despacho (botão "Tentar enviar agora") já tratou esta mensagem.
  }

  // Conta no banco, não no laço: pega também as que ficaram para trás quando o lote parou.
  const aguardando = await prisma.mensagem.count({ where: escopo });
  return { enviadas, aguardando, canceladas, ...(paradasPor ? { paradasPor } : {}) };
}
