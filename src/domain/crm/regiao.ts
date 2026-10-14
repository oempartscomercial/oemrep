// Estados do Brasil e a regra de região da Rudolph: o contrato só permite Norte e Nordeste
// (CLAUDE.md da pasta rep, regra 9).

const NORTE = ["AC", "AP", "AM", "PA", "RO", "RR", "TO"];
const NORDESTE = ["AL", "BA", "CE", "MA", "PB", "PE", "PI", "RN", "SE"];
const DEMAIS = ["DF", "GO", "MT", "MS", "ES", "MG", "RJ", "SP", "PR", "RS", "SC"];
const UFS = new Set([...NORTE, ...NORDESTE, ...DEMAIS]);

export function normalizarUf(uf: string): string | null {
  const sigla = uf.trim().toUpperCase();
  return UFS.has(sigla) ? sigla : null;
}

export function ufNorteNordeste(uf: string): boolean {
  const sigla = uf.trim().toUpperCase();
  return NORTE.includes(sigla) || NORDESTE.includes(sigla);
}
