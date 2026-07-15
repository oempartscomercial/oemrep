export type DadosAberturaChamado = {
  notaFiscalId: string;
  motivoId: string;
  observacao: string;
  itensAfetadosIds: string[];
};

export function validarAberturaChamado(dados: DadosAberturaChamado): string[] {
  const erros: string[] = [];

  if (!dados.notaFiscalId) erros.push("NFe de origem não informada.");
  if (!dados.motivoId) erros.push("Selecione o motivo da divergência.");
  if (!dados.observacao.trim()) erros.push("Descreva a divergência.");
  if (dados.itensAfetadosIds.length === 0) erros.push("Selecione ao menos um item afetado.");

  return erros;
}
