/**
 * Dinheiro em reais, com a formatação e a comparação num único lugar.
 *
 * A comparação existe porque as duas pontas do sistema têm precisões diferentes: a NFe
 * traz `vUnCom` com mais de duas casas (o layout da SEFAZ permite até dez) e o pedido
 * guarda `Decimal(12,2)`. Comparar os dois com `!==` acusa divergência em valores que são
 * o mesmo dinheiro. O centavo é a unidade de verdade.
 */

/** Converte reais para centavos inteiros, absorvendo o erro de ponto flutuante. */
export function emCentavos(valor: number): number {
  // `19.99 * 100` dá 1998.9999999999998 em ponto flutuante binário; `toPrecision(12)`
  // descarta o lixo antes do arredondamento, que aí acerta o centavo.
  return Math.round(Number((valor * 100).toPrecision(12)));
}

/** `1250.5` → `"R$ 1.250,50"`. */
export function formatarReais(valor: number): string {
  const centavos = emCentavos(valor);
  const absoluto = Math.abs(centavos);
  const inteiro = Math.trunc(absoluto / 100).toString();
  const resto = (absoluto % 100).toString().padStart(2, "0");
  const comMilhar = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${centavos < 0 ? "-" : ""}R$ ${comMilhar},${resto}`;
}
