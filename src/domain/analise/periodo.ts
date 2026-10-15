// Recorte do gráfico de pedidos × NFe por período. Meses são "AAAA-MM".
import type { PontoMensal } from "./totaisMensais";

export const PERIODOS = ["6m", "12m", "24m", "ano", "tudo"] as const;
export type Periodo = (typeof PERIODOS)[number];

function somarMeses(mes: string, n: number): string {
  const [a, m] = mes.split("-").map(Number);
  const total = a * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

function mesesEntre(de: string, ate: string): string[] {
  const meses: string[] = [];
  for (let m = de; m <= ate; m = somarMeses(m, 1)) meses.push(m);
  return meses;
}

/** Meses do período até `mesAtual`, em ordem. `primeiroComDado` é o início de "tudo". */
export function mesesDoPeriodo(periodo: Periodo, mesAtual: string, primeiroComDado: string): string[] {
  const inicio =
    periodo === "ano"
      ? `${mesAtual.slice(0, 4)}-01`
      : periodo === "tudo"
        ? primeiroComDado < mesAtual ? primeiroComDado : mesAtual
        : somarMeses(mesAtual, -(Number(periodo.replace("m", "")) - 1));
  return mesesEntre(inicio, mesAtual);
}

/** A série do período, com zero nos meses sem dado (o eixo do gráfico não pula mês). */
export function recortarSerie(serie: PontoMensal[], periodo: Periodo, mesAtual: string): PontoMensal[] {
  const porMes = new Map(serie.map((p) => [p.mes, p]));
  const primeiro = serie[0]?.mes ?? mesAtual;
  return mesesDoPeriodo(periodo, mesAtual, primeiro).map((mes) => porMes.get(mes) ?? { mes, valorPedido: 0, valorNfe: 0 });
}

/**
 * Primeiro mês com NFe registrada. Antes dele a NFe zerada é falta de acompanhamento,
 * não falta de faturamento.
 */
export function inicioDoAcompanhamentoNfe(serie: PontoMensal[]): string | null {
  return serie.find((p) => p.valorNfe > 0)?.mes ?? null;
}
