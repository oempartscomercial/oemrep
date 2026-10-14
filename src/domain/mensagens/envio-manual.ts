import { normalizarTelefone } from "./telefone";
import { verificarEnvio, type Bloqueio, type ContextoDeEnvio, type Limites, type MensagemDoHistorico } from "./envio";
import type { TipoEnvio } from "./rascunho";

// Envio manual assistido: sem o envio automático ligado, a pessoa abre a conversa no WhatsApp
// do celular de prospecção, envia e confirma na plataforma ("Já enviei").

/** Link wa.me com o texto já escrito. Nulo quando o número não é telefone. */
export function linkDoWhatsapp(numero: string, texto: string): string | null {
  const e164 = normalizarTelefone(numero);
  if (!e164) return null;
  return `https://wa.me/${e164.slice(1)}?text=${encodeURIComponent(texto)}`;
}

export type ContextoDoEnvioManual = Omit<ContextoDeEnvio, "linha" | "primeirosContatosHoje">;

/**
 * As proteções que valem quando é a pessoa quem envia: só as definitivas (não contatar,
 * empresa fora da prospecção, contato sem origem, duplicada...). As de espera (horário, linha,
 * limite do dia, intervalo) existem para o envio automático e não seguram o envio pelo celular.
 */
export function bloqueiosDoEnvioManual(c: ContextoDoEnvioManual): Bloqueio[] {
  const r = verificarEnvio({ ...c, linha: "conectada", primeirosContatosHoje: 0 });
  return r.ok ? [] : r.bloqueios.filter((b) => !b.espera);
}

export type EnvioPeloCelular = { link: string; bloqueio: null } | { link: null; bloqueio: string };

/** O que a tela oferece para uma mensagem aprovada: o link para enviar, ou por que não enviar. */
export function prepararEnvioPeloCelular(c: ContextoDoEnvioManual): EnvioPeloCelular {
  const bloqueios = bloqueiosDoEnvioManual(c);
  if (bloqueios.length > 0) return { link: null, bloqueio: bloqueios.map((b) => b.texto).join(" ") };
  const link = c.numero ? linkDoWhatsapp(c.numero, c.texto) : null;
  return link ? { link, bloqueio: null } : { link: null, bloqueio: "O número deste contato não é um telefone válido." };
}

type MensagemDaConversa = MensagemDoHistorico & { id: string; tipoEnvio: TipoEnvio | null };
export type ConversaParaEnvioManual = {
  numero: string;
  empresa: { situacao: string; naoContatar: boolean } | null;
  contato: { naoContatar: boolean; origemContato: string | null } | null;
  mensagens: MensagemDaConversa[];
};

/** Para cada mensagem nossa aprovada da conversa (por id): o link para enviar pelo celular ou por que não. */
export function envioPeloCelularDaConversa(c: ConversaParaEnvioManual, limites: Limites, agora: Date): Record<string, EnvioPeloCelular> {
  const resultado: Record<string, EnvioPeloCelular> = {};
  for (const m of c.mensagens) {
    if (m.direcao !== "SAIDA" || m.status !== "APROVADA" || !m.texto || !m.tipoEnvio) continue;
    resultado[m.id] =
      c.empresa && c.contato
        ? prepararEnvioPeloCelular({
            agora,
            tipo: m.tipoEnvio,
            texto: m.texto,
            empresa: c.empresa,
            contato: c.contato,
            numero: c.numero,
            historico: c.mensagens.filter((h) => h.id !== m.id),
            limites,
          })
        : { link: null, bloqueio: "A mensagem não está ligada a um contato cadastrado." };
  }
  return resultado;
}
