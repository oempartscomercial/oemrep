import type { Cliente, Contato, Conversa, Mensagem } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verificarEnvio, type Limites, type ResultadoDaVerificacao } from "@/domain/mensagens/envio";
import { diaEmSaoPaulo } from "@/domain/mensagens/exibicao";
import type { EstadoDaLinha } from "./transporte";
import { JA_SAIU, lerLimites } from "./limites";

// As proteções fixas (verificarEnvio) aplicadas a uma mensagem do banco: junta o histórico da
// conversa, os limites e quantos primeiros contatos já saíram hoje. Serve ao despacho (antes de
// enviar) e ao MCP (para dizer ao Claude o que seguraria o envio). Não decide nem grava nada.

export type MensagemParaVerificar = Mensagem & { conversa: Conversa & { cliente: Cliente | null; contato: Contato | null } };

export async function verificarMensagem(
  mensagem: MensagemParaVerificar,
  opcoes: { agora: Date; linha: EstadoDaLinha; limites?: Limites },
): Promise<{ verificacao: ResultadoDaVerificacao; limites: Limites } | null> {
  const { conversa } = mensagem;
  if (!conversa.cliente || !conversa.contato || !mensagem.tipoEnvio || !mensagem.texto) return null;

  const inicioDoDia = new Date(`${diaEmSaoPaulo(opcoes.agora)}T00:00:00-03:00`);
  const [historico, limites, primeirosContatosHoje] = await Promise.all([
    prisma.mensagem.findMany({
      where: { conversaId: conversa.id, id: { not: mensagem.id } },
      select: { direcao: true, status: true, texto: true, ocorridoEm: true },
    }),
    opcoes.limites ?? lerLimites(),
    prisma.mensagem.count({
      where: { linha: mensagem.linha, tipoEnvio: "PRIMEIRO_CONTATO", status: { in: [...JA_SAIU] }, enviadaEm: { gte: inicioDoDia, lt: new Date(inicioDoDia.getTime() + 86_400_000) } },
    }),
  ]);

  const verificacao = verificarEnvio({
    agora: opcoes.agora,
    tipo: mensagem.tipoEnvio,
    texto: mensagem.texto,
    empresa: { situacao: conversa.cliente.situacao, naoContatar: conversa.cliente.naoContatar },
    contato: { naoContatar: conversa.contato.naoContatar, origemContato: conversa.contato.origemContato },
    numero: conversa.numero,
    historico,
    primeirosContatosHoje,
    limites,
    linha: opcoes.linha,
  });
  return { verificacao, limites };
}
