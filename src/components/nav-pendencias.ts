// Selo numérico do item "Conversas" no menu lateral. Função pura: a casca (app-shell) só desenha.

const TETO = 99;

/** Texto visível e rótulo para leitor de tela; null quando não há nada a mostrar. */
export function formatarSeloPendencias(total: number | null | undefined): { texto: string; rotulo: string } | null {
  if (!total || total <= 0) return null;
  if (total > TETO) return { texto: `${TETO}+`, rotulo: `mais de ${TETO} pendências` };
  return { texto: String(total), rotulo: total === 1 ? "1 pendência" : `${total} pendências` };
}
