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
