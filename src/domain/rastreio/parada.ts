/** Dias sem ocorrência nova até uma nota em trânsito ser considerada parada (RF35). */
export const DIAS_NOTA_PARADA = 5;

export type NotaParaParada = { status: string; ultimaOcorrenciaEm: Date | null; dataEmissao: Date };

export function emTransito(status: string): boolean {
  return status === "TRANSITO" || status === "AGENDADO";
}

/** Em trânsito e sem novidade da transportadora há DIAS_NOTA_PARADA dias ou mais (conta da emissão se nunca houve ocorrência). */
export function notaParada(n: NotaParaParada, agora: Date = new Date()): boolean {
  if (!emTransito(n.status)) return false;
  const desde = n.ultimaOcorrenciaEm ?? n.dataEmissao;
  return agora.getTime() - desde.getTime() >= DIAS_NOTA_PARADA * 24 * 60 * 60 * 1000;
}
