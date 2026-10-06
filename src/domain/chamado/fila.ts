// Fila de divergências (RF27): recorte por situação e resumo para os indicadores.

export const SITUACOES_FILA = ["ABERTOS", "RESOLVIDOS", "TODOS"] as const;
export type SituacaoFila = (typeof SITUACOES_FILA)[number];

type ChamadoDaFila = { estado: string; critico: boolean };

export function lerSituacaoFila(valor: string | string[] | undefined): SituacaoFila {
  const texto = Array.isArray(valor) ? valor[0] : valor;
  return SITUACOES_FILA.find((s) => s === texto) ?? "ABERTOS";
}

export function filtrarFila<T extends ChamadoDaFila>(chamados: T[], situacao: SituacaoFila): T[] {
  if (situacao === "TODOS") return chamados;
  const resolvido = situacao === "RESOLVIDOS";
  return chamados.filter((c) => (c.estado === "RESOLVIDO") === resolvido);
}

export function resumirFila(chamados: ChamadoDaFila[]) {
  const abertos = chamados.filter((c) => c.estado !== "RESOLVIDO");
  return {
    abertos: abertos.length,
    criticos: abertos.filter((c) => c.critico).length,
    aguardando: abertos.filter((c) => c.estado === "AGUARDANDO").length,
    resolvidos: chamados.length - abertos.length,
  };
}
