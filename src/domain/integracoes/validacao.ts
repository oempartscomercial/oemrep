// O que a tela Integrações aceita (ADR-019). Segredo vazio ao editar = manter o salvo (null).

type Resultado<T> = { erros: string[]; valores?: T };

const URL_OK = /^https?:\/\/[^\s/]+(\/[^\s]*)?$/i;
const limparUrl = (u: string) => u.trim().replace(/\/+$/, "");
const segredo = (s: string | undefined) => (s?.trim() ? s.trim() : null);

export type EntradaEvolution = { url: string; instancia: string; apikey?: string };
export type EntradaChatwoot = { url: string; conta: string; token?: string };

export function validarEvolution(e: EntradaEvolution, temSegredoSalvo: boolean): Resultado<{ url: string; instancia: string; apikey: string | null }> {
  const erros: string[] = [];
  const url = limparUrl(e.url);
  const instancia = e.instancia.trim();
  const apikey = segredo(e.apikey);
  if (!URL_OK.test(url)) erros.push("Informe o endereço da Evolution começando com https://.");
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(instancia)) erros.push("Informe o nome da instância (letras, números, - ou _).");
  if (!apikey && !temSegredoSalvo) erros.push("Informe a chave (API key) da Evolution.");
  return erros.length > 0 ? { erros } : { erros, valores: { url, instancia, apikey } };
}

export function validarChatwoot(e: EntradaChatwoot, temSegredoSalvo: boolean): Resultado<{ url: string; conta: string; token: string | null }> {
  const erros: string[] = [];
  const url = limparUrl(e.url);
  const conta = e.conta.trim();
  const token = segredo(e.token);
  if (!URL_OK.test(url)) erros.push("Informe o endereço do Chatwoot começando com https://.");
  if (!/^\d{1,9}$/.test(conta)) erros.push("O número da conta do Chatwoot é só número (ex.: 1).");
  if (!token && !temSegredoSalvo) erros.push("Informe o token de acesso do Chatwoot.");
  return erros.length > 0 ? { erros } : { erros, valores: { url, conta, token } };
}
