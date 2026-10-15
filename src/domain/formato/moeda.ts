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

const FAIXAS: [number, string][] = [
  [1e9, "bi"],
  [1e6, "mi"],
  [1e3, "mil"],
];

/** Valor curto para eixo de gráfico e cartão: `1234567` → `"R$ 1,2 mi"`, `850000` → `"R$ 850 mil"`. */
export function abreviarReais(valor: number): string {
  const sinal = valor < 0 ? "-" : "";
  const absoluto = Math.abs(valor);
  const virgula = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 }).replace(/\./g, "");
  for (const [i, [base, sufixo]] of FAIXAS.entries()) {
    if (absoluto < base) continue;
    const n = Math.round((absoluto / base) * 10) / 10;
    // 999.960 vira "1.000 mil" no arredondamento: sobe para a faixa de cima.
    if (n >= 1000 && i > 0) return `${sinal}R$ ${virgula(n / 1000)} ${FAIXAS[i - 1][1]}`;
    return `${sinal}R$ ${virgula(n)} ${sufixo}`;
  }
  return `${sinal}R$ ${Math.round(absoluto)}`;
}
