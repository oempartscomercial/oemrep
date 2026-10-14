// Antes de cadastrar empresa nova: existe alguma com nome parecido? Mesma ideia da ferramenta
// local do Rômulo: "dispet" acha "Dispetral"; "Real Trator Peças" acha "Real Trator"; mas
// "Fortgiro" não acha "Giro".

const chave = (nome: string) =>
  nome
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function nomeParecido(novo: string, existente: string): boolean {
  const a = chave(novo);
  const b = chave(existente);
  if (!a || !b) return false;
  if (a === b) return true;
  // O novo como começo de palavra no existente ("dispet" → "dispetral").
  if (a.length >= 3 && new RegExp(`\\b${escapar(a)}`).test(b)) return true;
  // O existente inteiro, como palavras completas, dentro do novo ("real trator" ⊂ "real trator pecas").
  return b.length >= 4 && new RegExp(`\\b${escapar(b)}\\b`).test(a);
}
