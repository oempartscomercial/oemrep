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
// Teto de tentativas por execução, para um lote todo "esperando" não varrer a fila inteira.
const TENTATIVAS_POR_VAGA = 5;
export const MOTIVO_APROVACAO_VENCIDA = "Aprovada há mais de 7 dias sem conseguir enviar.";

export type ResumoDoEnvioAgendado = {
  enviadas: number;
  /** Continuam APROVADAS depois da execução. */
  aguardando: number;
  canceladas: number;
  /** Por que o lote parou antes de esgotar as aprovadas. */
  paradasPor?: string;
};

// Linha caída para o lote todo. Limite diário só segura primeiros contatos: follow-up e resposta
// não contam nele e continuam sendo tentados.
const LINHA_FORA = ["linha_desconectada", "linha_desconhecida"];

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
  const aprovadas = await prisma.mensagem.findMany({ where: escopo, orderBy: { aprovadaEm: "asc" }, select: { id: true, aprovadaEm: true, tipoEnvio: true } });

  let enviadas = 0;
  let canceladas = 0;
  let despachos = 0;
  let tentativas = 0;
  let paradasPor: string | undefined;
  let semPrimeiros = false;

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
    if (paradasPor || despachos >= limite || tentativas >= limite * TENTATIVAS_POR_VAGA) continue;
    if (semPrimeiros && m.tipoEnvio === "PRIMEIRO_CONTATO") continue;

    tentativas += 1;
    const resultado = await despachar(m.id, { transporte, agora });
    if (resultado.status === "ENVIADA") {
      despachos += 1;
      enviadas += 1;
    } else if (resultado.status === "CANCELADA") canceladas += 1;
    else if (resultado.status === "FALHOU") {
      despachos += 1;
      paradasPor = `Falha no envio: ${resultado.motivo ?? "sem detalhe"}`;
    } else if (resultado.status === "APROVADA") {
      // Esperando (horário, intervalo, limite): não gasta vaga do lote, para não travar as que podem sair.
      const codigos = resultado.codigos ?? [];
      if (codigos.some((c) => LINHA_FORA.includes(c))) paradasPor = "WhatsApp de prospecção desconectado: as mensagens continuam aprovadas.";
      else if (codigos.includes("limite_diario")) semPrimeiros = true;
    }
    // IGNORADA: outro despacho (botão "Tentar enviar agora") já tratou esta mensagem.
  }

  // Conta no banco, não no laço: pega também as que ficaram para trás quando o lote parou.
  const aguardando = await prisma.mensagem.count({ where: escopo });
  const motivoDoLimite = semPrimeiros ? "Limite diário de primeiros contatos atingido." : undefined;
  const parada = paradasPor ?? motivoDoLimite;
  return { enviadas, aguardando, canceladas, ...(parada ? { paradasPor: parada } : {}) };
}
