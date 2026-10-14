// Prazos de próximo passo. `prazo` e `hoje` são datas "AAAA-MM-DD" (sem hora).

export type SituacaoPrazo = "atrasado" | "hoje" | "futuro";

export function situacaoDoPrazo(prazo: string, hoje: string): SituacaoPrazo {
  if (prazo < hoje) return "atrasado";
  return prazo === hoje ? "hoje" : "futuro";
}

const DIA = 86_400_000;
const diasEntre = (de: string, ate: string) => Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / DIA);

/** "hoje", "amanhã", "ontem", "em 3 dias", "há 5 dias". */
export function descreverPrazo(prazo: string, hoje: string): string {
  const d = diasEntre(hoje, prazo);
  if (d === 0) return "hoje";
  if (d === 1) return "amanhã";
  if (d === -1) return "ontem";
  return d > 0 ? `em ${d} dias` : `há ${-d} dias`;
}

export function somarDias(dia: string, dias: number): string {
  return new Date(Date.parse(`${dia}T00:00:00Z`) + dias * DIA).toISOString().slice(0, 10);
}

/** 2026-10-09 → 09/10/2026 */
export function formatarDia(dia: string): string {
  const [a, m, d] = dia.split("-");
  return `${d}/${m}/${a}`;
}

export const hojeEmSaoPaulo = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

/** Sábado e domingo passam para a segunda seguinte. */
export function proximoDiaUtil(dia: string): string {
  const semana = new Date(`${dia}T00:00:00Z`).getUTCDay();
  return semana === 6 ? somarDias(dia, 2) : semana === 0 ? somarDias(dia, 1) : dia;
}

const DIAS_DA_SEMANA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

/** 2026-10-12 → "segunda" */
export function diaDaSemana(dia: string): string {
  return DIAS_DA_SEMANA[new Date(`${dia}T00:00:00Z`).getUTCDay()];
}

/** 2026-10-16 → "sexta, 16/10/2026" */
export function formatarDiaComSemana(dia: string): string {
  return `${diaDaSemana(dia)}, ${formatarDia(dia)}`;
}

function diaValido(a: number, m: number, d: number): string | null {
  const data = new Date(Date.UTC(a, m - 1, d));
  if (data.getUTCFullYear() !== a || data.getUTCMonth() !== m - 1 || data.getUTCDate() !== d) return null;
  return data.toISOString().slice(0, 10);
}

/**
 * Data dita em conversa → "AAAA-MM-DD". Aceita 2026-10-20, 20/10/2026, 20/10 (ano de hoje),
 * "hoje" e "amanhã". O resto devolve null: quem chama pergunta, não adivinha.
 */
export function interpretarDia(texto: string, hoje: string): string | null {
  const t = texto.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (t === "hoje") return hoje;
  if (t === "amanha") return somarDias(hoje, 1);
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (m) return diaValido(+m[1], +m[2], +m[3]);
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t);
  if (m) return diaValido(+m[3], +m[2], +m[1]);
  m = /^(\d{1,2})\/(\d{1,2})$/.exec(t);
  if (m) return diaValido(+hoje.slice(0, 4), +m[2], +m[1]);
  return null;
}
