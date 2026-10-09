// Ocorrências de rastreio de uma NFe em transporte, já normalizadas (independem da transportadora).
// Módulo puro: sem I/O e sem relógio. A origem (SSW, etc.) converte para `Ocorrencia` antes.

export type StatusSugerido = "TRANSITO" | "AGENDADO" | "RECEBIDA" | "EXTRAVIADO";

export type Ocorrencia = {
  data: Date | null;
  descricao: string;
  local: string | null;
  codigo: string | null;
};

// Códigos numéricos do SSW vistos pareados com o texto na resposta real (2026-10-09), no formato
// "NOME DA OCORRENCIA (70)". Só entra o que foi confirmado assim.
const CODIGOS_SSW: Record<string, StatusSugerido> = {
  "70": "TRANSITO", // DOCUMENTO DE TRANSPORTE EMITIDO
  "72": "TRANSITO", // SAIDA DE UNIDADE
  "75": "TRANSITO", // CHEGADA EM UNIDADE DE TRANSBORDO
};

// Palavras já normalizadas (sem acento, maiúsculas).
const PERDA = ["EXTRAVI", "SINISTR", "ROUB", "AVARIA TOTAL"];
const ENTREGUE = ["ENTREGA REALIZADA", "MERCADORIA ENTREGUE", "ENTREGUE"];
const AGENDADO = ["AGENDAD", "AGENDAMENTO"];
const TRANSITO = [
  "EM TRANSITO",
  "TRANSFERENCIA",
  "CHEGADA",
  "SAIDA",
  "COLETA",
  "EM ROTA",
  "EMISSAO DO CT-E",
  "DOCUMENTO EMITIDO",
  "DOCUMENTO DE TRANSPORTE EMITIDO",
];

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

function contem(texto: string, termos: string[]): boolean {
  return termos.some((termo) => texto.includes(termo));
}

// Converte o texto de uma ocorrência no status que ela sugere. Desconhecido vira null.
// Perda vira EXTRAVIADO aqui, mas `statusSugerido` nunca o devolve: quem confirma perda é uma pessoa.
export function statusDaOcorrencia(o: Pick<Ocorrencia, "descricao" | "codigo">): StatusSugerido | null {
  const texto = normalizar(o.descricao);

  if (contem(texto, PERDA)) return "EXTRAVIADO";

  // "NAO ENTREGUE" / "ENTREGA NAO REALIZADA" não é entrega: pula só a checagem de entregue.
  const negada = /\bNAO\b/.test(texto) && /ENTREGA|ENTREGUE/.test(texto);
  if (!negada && contem(texto, ENTREGUE)) return "RECEBIDA";

  if (contem(texto, AGENDADO)) return "AGENDADO";
  if (contem(texto, TRANSITO)) return "TRANSITO";

  if (o.codigo && CODIGOS_SSW[o.codigo]) return CODIGOS_SSW[o.codigo];
  return null;
}

// Ordem cronológica crescente. Sem data vai para o começo (é a mais antiga possível).
// Array.prototype.sort é estável: empates e datas nulas mantêm a ordem da lista, que o SSW
// já manda em ordem cronológica.
function ordenarCronologicamente(lista: Ocorrencia[]): Ocorrencia[] {
  return [...lista].sort((a, b) => {
    const ta = a.data ? a.data.getTime() : -Infinity;
    const tb = b.data ? b.data.getTime() : -Infinity;
    if (ta === tb) return 0;
    return ta < tb ? -1 : 1;
  });
}

// Ocorrência mais recente. Em empate de data, vale a última da lista.
export function ultimaOcorrencia(lista: Ocorrencia[]): Ocorrencia | null {
  const ordenada = ordenarCronologicamente(lista);
  return ordenada.length > 0 ? ordenada[ordenada.length - 1] : null;
}

// Status sugerido para a NFe inteiro.
// - Se alguma ocorrência é RECEBIDA, ela vence (TRANSITO posterior é ruído).
// - Senão, vale o status da ocorrência mais recente que mapeia para alguma coisa.
// - EXTRAVIADO nunca é sugerido: retorna null.
export function statusSugerido(lista: Ocorrencia[]): StatusSugerido | null {
  const estados = ordenarCronologicamente(lista).map(statusDaOcorrencia);

  if (estados.includes("RECEBIDA")) return "RECEBIDA";

  for (let i = estados.length - 1; i >= 0; i--) {
    const estado = estados[i];
    if (estado === null) continue;
    return estado === "EXTRAVIADO" ? null : estado;
  }
  return null;
}
