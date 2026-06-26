export type EventoAuditoriaInput = {
  entidade: string;
  entidadeId: string;
  campo: string;
  valorAnterior: string | null;
  valorNovo: string | null;
  usuarioId: string;
};

function paraTexto(valor: unknown): string | null {
  return valor === null || valor === undefined ? null : String(valor);
}

export function compararCampos(
  entidade: string,
  entidadeId: string,
  usuarioId: string,
  antes: Record<string, unknown>,
  depois: Record<string, unknown>,
): EventoAuditoriaInput[] {
  const eventos: EventoAuditoriaInput[] = [];

  for (const campo of Object.keys(depois)) {
    const valorAnterior = antes[campo];
    const valorNovo = depois[campo];
    if (valorAnterior !== valorNovo) {
      eventos.push({
        entidade,
        entidadeId,
        campo,
        valorAnterior: paraTexto(valorAnterior),
        valorNovo: paraTexto(valorNovo),
        usuarioId,
      });
    }
  }

  return eventos;
}
