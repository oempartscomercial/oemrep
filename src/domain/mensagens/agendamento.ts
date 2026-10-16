import { diaDaSemana, formatarDiaComSemana, interpretarDia, somarDias } from "@/domain/crm/prazo";
import { proximaJanelaComercial, type JanelaComercial } from "./horario";
import { diaEmSaoPaulo, formatarHora } from "./exibicao";

// Mensagem aprovada pode ter hora marcada para sair (ADR-019). Aqui só se entende o que a pessoa
// (ou o Claude) disse e se diz quando sai de fato; quem envia é o despacho, com as proteções de sempre.
// São Paulo está em -03:00 o ano todo (sem horário de verão desde 2019).

export type Momento = { tipo: "agora" } | { tipo: "em"; quando: Date };

const MAX_DIAS = 30;
const DIAS = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"];
const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const emSaoPaulo = (dia: string, h: number, m: number) => new Date(`${dia}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00-03:00`);

// "9h", "9h30", "09:00", "9:30", "às 9h". Devolve [hora, minuto] ou null; ausente = undefined.
function lerHora(t: string): [number, number] | null | undefined {
  const limpo = t.replace(/\bas\b/g, " ").trim();
  if (!limpo) return undefined;
  const m = /^(\d{1,2})(?:h(\d{2})?|:(\d{2}))h?$/.exec(limpo.replace(/\s+/g, ""));
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2] ?? m[3] ?? 0);
  return h <= 23 && min <= 59 ? [h, min] : null;
}

/** "agora", "amanhã 9h", "segunda 14h", "23/10 9h", "23/10/2026 09:00", "2026-10-23T09:00". O resto: null. */
export function interpretarMomento(texto: string, agora: Date, horaPadrao: number): Momento | null {
  const t = semAcento(texto).trim().replace(/\s+/g, " ");
  if (!t || t === "agora" || t === "ja" || t === "agora mesmo") return { tipo: "agora" };
  const hoje = diaEmSaoPaulo(agora);

  // Formato do campo de data e hora da tela, ou ISO com espaço.
  const iso = /^(\d{4}-\d{2}-\d{2})[t ](\d{2}):(\d{2})$/.exec(t);
  if (iso) {
    const dia = interpretarDia(iso[1], hoje);
    const [h, m] = [Number(iso[2]), Number(iso[3])];
    return dia && h <= 23 && m <= 59 ? { tipo: "em", quando: emSaoPaulo(dia, h, m) } : null;
  }

  const [primeira, ...resto] = t.split(" ");
  const restoTexto = resto.join(" ");
  let dia: string | null = null;
  let horaTexto = restoTexto;

  const semana = DIAS.findIndex((d) => primeira === d || primeira === `${d}-feira`);
  if (semana >= 0) {
    const hora = lerHora(restoTexto);
    if (hora === null) return null;
    const [h, m] = hora ?? [horaPadrao, 0];
    // A próxima ocorrência desse dia; hoje só vale se a hora ainda não passou.
    for (let i = 0; i <= 7; i++) {
      const candidato = somarDias(hoje, i);
      if (semAcento(diaDaSemana(candidato)) !== DIAS[semana]) continue;
      if (emSaoPaulo(candidato, h, m) <= agora) continue;
      return { tipo: "em", quando: emSaoPaulo(candidato, h, m) };
    }
    return null;
  }

  dia = interpretarDia(primeira, hoje);
  if (!dia) {
    // Só a hora ("16h"): hoje.
    const hora = lerHora(t);
    if (!hora) return null;
    return { tipo: "em", quando: emSaoPaulo(hoje, hora[0], hora[1]) };
  }
  const hora = lerHora(horaTexto);
  if (hora === null) return null;
  const [h, m] = hora ?? [horaPadrao, 0];
  return { tipo: "em", quando: emSaoPaulo(dia, h, m) };
}

/** Erro em português, ou null se dá para agendar. */
export function validarAgendamento(quando: Date, agora: Date): string | null {
  if (quando.getTime() < agora.getTime() - 60_000) return "Esse horário já passou. Diga outro dia e hora.";
  if (quando.getTime() > agora.getTime() + MAX_DIAS * 86_400_000) return `Dá para agendar até ${MAX_DIAS} dias à frente.`;
  return null;
}

/** O primeiro instante em que a mensagem pode sair: a hora marcada (ou agora), empurrada para dentro do horário comercial. */
export function quandoPodeSair(agendadaPara: Date | null, agora: Date, janela: JanelaComercial): Date | null {
  const base = agendadaPara && agendadaPara > agora ? agendadaPara : agora;
  return proximaJanelaComercial(base, janela);
}

/** "segunda, 19/10/2026 às 09:00" */
export function descreverMomento(d: Date): string {
  return `${formatarDiaComSemana(diaEmSaoPaulo(d))} às ${formatarHora(d)}`;
}
