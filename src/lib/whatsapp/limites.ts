import { obterParametroNumero } from "@/lib/parametros";
import type { Limites } from "@/domain/mensagens/envio";

// Limites da linha de prospecção (ADR-015 §4), ajustáveis na tabela Parametro.

export const JA_SAIU = ["ENVIANDO", "ENVIADA", "ENTREGUE", "LIDA"] as const;

export async function lerLimites(): Promise<Limites> {
  const [horarioInicio, horarioFim, maxPrimeirosPorDia, diasEntreMensagens, maxTentativas] = await Promise.all([
    obterParametroNumero("whatsapp_horario_inicio", 8),
    obterParametroNumero("whatsapp_horario_fim", 18),
    obterParametroNumero("whatsapp_limite_primeiros_dia", 15),
    obterParametroNumero("whatsapp_dias_entre_mensagens", 3),
    obterParametroNumero("whatsapp_max_tentativas", 3),
  ]);
  return { horarioInicio, horarioFim, maxPrimeirosPorDia, diasEntreMensagens, maxTentativas };
}
