// Pedido de parar tem prioridade absoluta (ADR-015 §5) e é decidido por regra de texto,
// não por IA. A regra erra para o lado seguro: na dúvida entre mandar de novo e deixar de
// mandar, deixa de mandar. Uma pessoa desfaz um falso positivo; uma mensagem indevida não
// se desfaz.

export type ClassificacaoPorRegra = "NAO_CONTATAR" | "NAO_INTERESSADO" | null;

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Mensagem curta que começa pela palavra de comando ("parar", "sair da lista").
const COMANDOS = new Set(["parar", "pare", "sair", "remover", "remova", "stop", "descadastrar", "descadastre", "unsubscribe"]);

const PEDIDOS_DE_PARAR: RegExp[] = [
  /\bnao (quero|queremos) mais\b/,
  /\bnao (quero|queremos) (receber|ser contatad|contato|mensagem)/,
  /\bnao (me|nos) (envie|enviem|mande|mandem|chame|chamem|procure|procurem|escreva|escrevam|ligue|liguem)\b/,
  /\bnao (envie|enviem|mande|mandem) mais\b/,
  /\bnao (entre|entrem|entremos) mais em contato/,
  /\b(pare|parem|para) de (me |nos )?(enviar|mandar|escrever|chamar|ligar|incomodar)/,
  /\b(me |nos )(remova|removam|remove|exclua|excluam)\b/,
  /\b(remova|removam|exclua|excluam|tire|tirem|retire|retirem)\b (me |nos |meu |nosso |o meu |o nosso )?(numero |contato |telefone |whatsapp |cadastro )?(da|do|de) (sua |suas |nossa |nosso )?(lista|base|cadastro)\b/,
  /\b(remova|removam|tire|tirem|retire|retirem|exclua|excluam) (meu|nosso|o meu|o nosso) (numero|contato|telefone|whatsapp)\b/,
  /\bdescadastr/,
  /\bspam\b/,
];

// Recusa da proposta: não suprime sozinha (quem decide é uma pessoa), mas encerra a cadência.
const SEM_INTERESSE: RegExp[] = [/\bnao (tenho|temos|tem) interesse\b/, /\bsem interesse\b/, /\bnao (me|nos) interessa/];
const SEM_INTERESSE_CURTA: RegExp[] = [/\bnao (quero|queremos)\b/, /\bnao (preciso|precisamos)\b/];
const LIMITE_DA_CURTA = 6;

export function classificarPorRegra(texto: string | null): ClassificacaoPorRegra {
  if (!texto) return null;
  const limpo = normalizar(texto);
  if (!limpo) return null;
  const palavras = limpo.split(" ");

  if (palavras.length <= 4 && COMANDOS.has(palavras[0])) return "NAO_CONTATAR";
  if (PEDIDOS_DE_PARAR.some((r) => r.test(limpo))) return "NAO_CONTATAR";

  if (SEM_INTERESSE.some((r) => r.test(limpo))) return "NAO_INTERESSADO";
  if (palavras.length <= LIMITE_DA_CURTA && SEM_INTERESSE_CURTA.some((r) => r.test(limpo))) return "NAO_INTERESSADO";
  return null;
}
