// Paginação das listas: lê ?pagina= e recorta a lista já filtrada.
export const POR_PAGINA = 50;

export function lerPagina(valor: string | undefined): number {
  const pagina = Number(valor);
  return Number.isInteger(pagina) && pagina > 1 ? pagina : 1;
}

export function paginar<T>(lista: T[], pagina: number, porPagina = POR_PAGINA) {
  // Página além do fim (lista encolheu depois de um filtro) cai na última.
  const ultima = Math.max(1, Math.ceil(lista.length / porPagina));
  const atual = Math.min(pagina, ultima);
  return { itens: lista.slice((atual - 1) * porPagina, atual * porPagina), pagina: atual, total: lista.length };
}
