import { mesmoTelefone, normalizarTelefone } from "@/domain/mensagens/telefone";
import { criarTransporteEvolution, ErroDeEnvio, type TransporteWhatsapp } from "./transporte";

// Envio pelo Chatwoot (ADR-019 §10): a mensagem nasce na caixa de entrada como enviada pelo
// agente, e a integração Evolution → Chatwoot que já existe leva ao WhatsApp. Assim o Rômulo vê
// no Chatwoot tudo o que o sistema mandou, na mesma conversa em que o contato responde.
// O id do WhatsApp só existe depois que a Evolution envia: aqui devolvemos idExterno nulo e o
// eco que chega pelo webhook adota a mensagem (registrar.ts, adotarEcoDeEnvio).

type ConfigEvolution = { url: string; apikey: string; instancia: string };
type ConfigChatwoot = { url: string; conta: string; token: string };

const TEMPO_LIMITE_MS = 15_000;

type ContatoChatwoot = { id: number; phone_number?: string | null; identifier?: string | null; contact_inboxes?: { source_id?: string; inbox?: { id?: number } }[] };
type ConversaChatwoot = { id: number; inbox_id: number; status?: string; last_activity_at?: number };

export function criarTransporteChatwoot(
  config: { evolution: ConfigEvolution; chatwoot: ConfigChatwoot },
  fetchFn: typeof fetch = fetch,
): TransporteWhatsapp {
  const evolution = criarTransporteEvolution(config.evolution, fetchFn);
  const base = `${config.chatwoot.url.replace(/\/+$/, "")}/api/v1/accounts/${encodeURIComponent(config.chatwoot.conta)}`;

  // Antes de a mensagem ser criada nada saiu: qualquer falha aqui tem certeza de que não enviou.
  async function chamar<T>(caminho: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
    let r: Response;
    try {
      r = await fetchFn(base + caminho, {
        method: init.method ?? "GET",
        headers: { api_access_token: config.chatwoot.token, "content-type": "application/json" },
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
        signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
        cache: "no-store",
      });
    } catch (erro) {
      throw new ErroDeEnvio(`Sem resposta do Chatwoot: ${erro instanceof Error ? erro.message : String(erro)}`, true);
    }
    if (!r.ok) throw new ErroDeEnvio(`O Chatwoot recusou o pedido (HTTP ${r.status}).`, true);
    return (await r.json()) as T;
  }

  // A caixa é a que a Evolution alimenta: o nome vem da própria integração, não de configuração nossa.
  async function caixaDaEvolution(): Promise<number> {
    const evo = config.evolution;
    let nome: string | undefined;
    try {
      const r = await fetchFn(`${evo.url.replace(/\/+$/, "")}/chatwoot/find/${evo.instancia}`, {
        headers: { apikey: evo.apikey },
        signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
        cache: "no-store",
      });
      const dados = r.ok ? ((await r.json()) as { enabled?: boolean; nameInbox?: string } | null) : null;
      if (dados?.enabled) nome = dados.nameInbox;
    } catch {
      // cai no erro abaixo
    }
    if (!nome) throw new ErroDeEnvio("A Evolution não está ligada a uma caixa do Chatwoot.", true);
    const { payload = [] } = await chamar<{ payload?: { id: number; name: string }[] }>("/inboxes");
    const caixa = payload.find((c) => c.name === nome);
    if (!caixa) throw new ErroDeEnvio(`Não achei a caixa "${nome}" no Chatwoot.`, true);
    return caixa.id;
  }

  async function acharContato(numero: string): Promise<ContatoChatwoot | null> {
    const busca = numero.replace(/\D/g, "").slice(-8);
    const { payload = [] } = await chamar<{ payload?: ContatoChatwoot[] }>(`/contacts/search?q=${busca}&include_contacts=true`);
    return (
      payload.find((c) => {
        const tel = normalizarTelefone(c.phone_number ?? "") ?? normalizarTelefone(c.identifier ?? "");
        return tel !== null && mesmoTelefone(tel, numero);
      }) ?? null
    );
  }

  async function conversaDoContato(contato: ContatoChatwoot, caixa: number): Promise<number | null> {
    const { payload = [] } = await chamar<{ payload?: ConversaChatwoot[] }>(`/contacts/${contato.id}/conversations`);
    const daCaixa = payload
      .filter((c) => c.inbox_id === caixa)
      .sort((a, b) => Number(b.status === "open") - Number(a.status === "open") || (b.last_activity_at ?? b.id) - (a.last_activity_at ?? a.id));
    return daCaixa[0]?.id ?? null;
  }

  async function abrirConversa(numero: string, contato: ContatoChatwoot | null, caixa: number): Promise<number> {
    let contatoId: number;
    let sourceId: string | undefined;
    if (contato) {
      contatoId = contato.id;
      sourceId = contato.contact_inboxes?.find((ci) => ci.inbox?.id === caixa)?.source_id;
      if (!sourceId) {
        const ci = await chamar<{ source_id?: string }>(`/contacts/${contato.id}/contact_inboxes`, { method: "POST", body: { inbox_id: caixa } });
        sourceId = ci.source_id;
      }
    } else {
      const novo = await chamar<{ payload?: { contact?: ContatoChatwoot; contact_inbox?: { source_id?: string } } }>("/contacts", {
        method: "POST",
        body: { inbox_id: caixa, name: numero, phone_number: numero },
      });
      if (!novo.payload?.contact) throw new ErroDeEnvio("O Chatwoot não devolveu o contato criado.", true);
      contatoId = novo.payload.contact.id;
      sourceId = novo.payload.contact_inbox?.source_id ?? novo.payload.contact.contact_inboxes?.find((ci) => ci.inbox?.id === caixa)?.source_id;
    }
    if (!sourceId) throw new ErroDeEnvio("O Chatwoot não ligou o contato à caixa do WhatsApp.", true);
    const conversa = await chamar<{ id?: number }>("/conversations", {
      method: "POST",
      body: { source_id: sourceId, inbox_id: caixa, contact_id: contatoId, status: "open" },
    });
    if (!conversa.id) throw new ErroDeEnvio("O Chatwoot não devolveu a conversa criada.", true);
    return conversa.id;
  }

  return {
    nome: "chatwoot",
    estado: () => evolution.estado(),
    async enviarTexto(numeroE164, texto) {
      const caixa = await caixaDaEvolution();
      const contato = await acharContato(numeroE164);
      const conversa = (contato && (await conversaDoContato(contato, caixa))) ?? (await abrirConversa(numeroE164, contato, caixa));

      // Daqui em diante a mensagem pode ter saído: só 4xx dá certeza de que não.
      let r: Response;
      try {
        r = await fetchFn(`${base}/conversations/${conversa}/messages`, {
          method: "POST",
          headers: { api_access_token: config.chatwoot.token, "content-type": "application/json" },
          body: JSON.stringify({ content: texto, message_type: "outgoing", private: false }),
          signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
          cache: "no-store",
        });
      } catch (erro) {
        throw new ErroDeEnvio(`Sem resposta do Chatwoot: ${erro instanceof Error ? erro.message : String(erro)}`, false);
      }
      if (r.status >= 400 && r.status < 500) throw new ErroDeEnvio(`O Chatwoot recusou a mensagem (HTTP ${r.status}).`, true);
      if (!r.ok) throw new ErroDeEnvio(`Erro do Chatwoot (HTTP ${r.status}).`, false);
      return { idExterno: null };
    },
  };
}
