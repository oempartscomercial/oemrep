// Iniciais para o avatar de empresa e de pessoa.

const CONECTIVOS = new Set(["de", "da", "do", "das", "dos", "e", "&"]);

/** "Ditrac Agrícola Parts" → "DA"; "Rômulo" → "R". */
export function iniciais(nome: string): string {
  const palavras = nome
    .split(/\s+/)
    .map((p) => p.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter((p) => p && !CONECTIVOS.has(p.toLowerCase()));
  if (palavras.length === 0) return "?";
  return palavras
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");
}
