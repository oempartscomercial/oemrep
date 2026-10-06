export type TipoEnvio = "PRIMEIRO_CONTATO" | "FOLLOW_UP" | "RESPOSTA";

// Regras de texto de uma mensagem a terceiros (CLAUDE.md da pasta rep, ADR-015 §7). Valem
// para qualquer autor, pessoa ou IA: o texto é checado aqui antes de aprovar.
export type ResultadoDoRascunho = { erros: string[]; avisos: string[] };

const LIMITE_GERAL = 1500;
const LIMITE_PRIMEIRO_CONTATO = 450;
const LINK = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|br)\b)/i;
const ESPACO_POR_PREENCHER = /\[[^\]]*\]/;

// Afirmar que uma peça substitui outra sem confirmação da fábrica é proibido. Só o que
// afirma é sinalizado; perguntar ou prometer confirmar ("vou ver se existe equivalente") não.
const AFIRMA_EQUIVALENCIA = /\b(substitui|substituem|equivale|equivalem|e equivalente|sao equivalentes|e o mesmo que|serve (no|na|em|para o|para a)|compativel com)\b/;

const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function validarRascunho(texto: string, tipo: TipoEnvio): ResultadoDoRascunho {
  const limpo = texto.trim();
  if (!limpo) return { erros: ["Escreva a mensagem."], avisos: [] };

  const erros: string[] = [];
  const avisos: string[] = [];
  if (limpo.length > LIMITE_GERAL) erros.push(`Mensagem longa demais (até ${LIMITE_GERAL} caracteres).`);
  if (ESPACO_POR_PREENCHER.test(limpo)) erros.push("Preencha o que está entre colchetes antes de aprovar.");

  if (tipo === "PRIMEIRO_CONTATO") {
    if (LINK.test(limpo)) erros.push("A primeira mensagem não leva link: o objetivo é descobrir quem compra.");
    if (limpo.length > LIMITE_PRIMEIRO_CONTATO) erros.push(`A primeira mensagem deve ser curta (até ${LIMITE_PRIMEIRO_CONTATO} caracteres).`);
    if (!limpo.includes("?")) erros.push("A primeira mensagem precisa de uma pergunta: pergunte quem cuida da compra.");
  }

  if (AFIRMA_EQUIVALENCIA.test(semAcento(limpo).replace(/[^a-z0-9]+/g, " "))) {
    avisos.push("Parece afirmar que uma peça substitui ou equivale a outra. Só diga isso com a equivalência confirmada pela fábrica.");
  }
  return { erros, avisos };
}

/** Modelo do CLAUDE.md. Sem a peça, deixa o espaço entre colchetes: a validação não deixa aprovar assim. */
export function rascunhoDePrimeiroContato(peca?: string): string {
  const vista = peca?.trim() || "[peça/marca vista no site]";
  return `Olá, tudo bem? Sou o Rômulo, da OEM Rep. Representamos a Rudolph, fábrica de peças de transmissão para tratores. Vi que vocês trabalham com ${vista}. Quem cuida da compra dessa linha aí? Gostaria de apresentar nosso catálogo.`;
}

export function rascunhoDeFollowUp(): string {
  return "Olá, tudo bem? Passando para saber se você chegou a ver minha mensagem sobre a linha Rudolph, de peças de transmissão para tratores. Quem cuida da compra dessa linha aí?";
}
