import { normalizarTelefone } from "@/domain/mensagens/telefone";

// Administração da instância na Evolution API (tela Integrações, ADR-019): testar a chave, ver se
// o celular está conectado, mostrar o QR Code, criar a instância e apontar o webhook para o
// sistema. Só mexe no webhook da instância: a integração com o Chatwoot é outra rota da Evolution
// (/chatwoot/set) e fica como está. Envio de mensagem é do transporte (src/lib/whatsapp/transporte.ts).
//
// Rotas e formatos da Evolution API v2 (os mesmos que a ferramenta da pasta rep usa). O corpo do
// /webhook/set foi escrito pelo formato documentado da v2; por isso a tela lê o webhook de volta
// depois de configurar.

export type ConfigEvolution = { url: string; apikey: string; instancia: string };

export type EstadoConexao = "conectada" | "desconectada" | "conectando" | "desconhecida";
export type EstadoDaInstancia = { existe: boolean; estado: EstadoConexao; numero: string | null; nomePerfil: string | null };
export type Falha = { ok: false; erro: string };

/** Eventos que o sistema precisa: mensagem recebida, recibo, mensagem enviada e conexão. */
export const EVENTOS_DO_WEBHOOK = ["MESSAGES_UPSERT", "MESSAGES_UPDATE", "SEND_MESSAGE", "CONNECTION_UPDATE"];

const TEMPO_LIMITE_MS = 15_000;
const FORA_DO_AR = "Não consegui falar com a Evolution nesse endereço.";
const CHAVE_RECUSADA = "A Evolution recusou a chave (API key). Confira e salve de novo.";

type Objeto = Record<string, unknown>;
const ehObjeto = (v: unknown): v is Objeto => typeof v === "object" && v !== null && !Array.isArray(v);
const texto = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

const ESTADOS: Record<string, EstadoConexao> = { open: "conectada", close: "desconectada", connecting: "conectando" };
export const lerEstado = (bruto: unknown): EstadoConexao => ESTADOS[String(bruto ?? "").toLowerCase()] ?? "desconhecida";

// v2: { name, connectionStatus, ownerJid, profileName }. v1: { instance: { instanceName, status, owner, profileName } }.
function lerInstancia(item: unknown): { nome: string | null; estado: EstadoConexao; numero: string | null; nomePerfil: string | null } {
  const raiz = ehObjeto(item) ? item : {};
  const i = ehObjeto(raiz.instance) ? raiz.instance : raiz;
  const dono = texto(i.ownerJid) ?? texto(i.owner) ?? texto(i.number);
  return {
    nome: texto(i.name) ?? texto(i.instanceName),
    estado: lerEstado(i.connectionStatus ?? i.status ?? i.state),
    numero: dono ? normalizarTelefone(dono.includes("@") ? dono : `+${dono.replace(/\D/g, "")}`) : null,
    nomePerfil: texto(i.profileName),
  };
}

export function clienteEvolution(cfg: ConfigEvolution, fetchFn: typeof fetch = fetch) {
  const base = cfg.url.replace(/\/+$/, "");
  const cabecalhos = { apikey: cfg.apikey, "content-type": "application/json" };
  const inst = encodeURIComponent(cfg.instancia);

  async function chamar(metodo: "GET" | "POST", caminho: string, corpo?: unknown): Promise<{ status: number; dados: unknown } | null> {
    try {
      const r = await fetchFn(`${base}${caminho}`, {
        method: metodo,
        headers: cabecalhos,
        ...(corpo === undefined ? {} : { body: JSON.stringify(corpo) }),
        signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
        cache: "no-store",
      });
      return { status: r.status, dados: await r.json().catch(() => null) };
    } catch {
      return null;
    }
  }

  const falha = (r: { status: number } | null, padrao: string): Falha => {
    if (!r) return { ok: false, erro: FORA_DO_AR };
    if (r.status === 401 || r.status === 403) return { ok: false, erro: CHAVE_RECUSADA };
    return { ok: false, erro: `${padrao} (a Evolution respondeu ${r.status}).` };
  };

  async function instancias(): Promise<{ ok: true; lista: ReturnType<typeof lerInstancia>[] } | Falha> {
    const r = await chamar("GET", "/instance/fetchInstances");
    if (!r || r.status !== 200 || !Array.isArray(r.dados)) return falha(r, "Esse endereço não parece ser uma Evolution API");
    return { ok: true, lista: r.dados.map(lerInstancia) };
  }

  return {
    async testar(): Promise<{ ok: true; instanciaExiste: boolean } | Falha> {
      const r = await instancias();
      if (!r.ok) return r;
      return { ok: true, instanciaExiste: r.lista.some((i) => i.nome === cfg.instancia) };
    },

    async estado(): Promise<EstadoDaInstancia> {
      const r = await instancias();
      const achada = r.ok ? r.lista.find((i) => i.nome === cfg.instancia) : undefined;
      if (!achada) return { existe: false, estado: "desconhecida", numero: null, nomePerfil: null };
      // Desconectado, o WhatsApp não tem dono: o número antigo não vale mais.
      return { existe: true, estado: achada.estado, numero: achada.estado === "conectada" ? achada.numero : null, nomePerfil: achada.nomePerfil };
    },

    async qrCode(): Promise<{ tipo: "qr"; imagem: string; codigoPareamento: string | null } | { tipo: "conectada" } | ({ tipo: "erro" } & Falha)> {
      const r = await chamar("GET", `/instance/connect/${inst}`);
      if (!r || r.status !== 200 || !ehObjeto(r.dados)) return { tipo: "erro", ...falha(r, "Não consegui pedir o QR Code") };
      const base64 = texto(r.dados.base64);
      if (base64) {
        const imagem = base64.startsWith("data:") ? base64 : `data:image/png;base64,${base64}`;
        return { tipo: "qr", imagem, codigoPareamento: texto(r.dados.pairingCode) };
      }
      const estado = ehObjeto(r.dados.instance) ? r.dados.instance.state : r.dados.state;
      if (lerEstado(estado) === "conectada") return { tipo: "conectada" };
      return { tipo: "erro", ok: false, erro: "A Evolution não mandou o QR Code agora. Tente de novo em alguns segundos." };
    },

    async criarInstancia(): Promise<{ ok: true } | Falha> {
      const r = await chamar("POST", "/instance/create", { instanceName: cfg.instancia, integration: "WHATSAPP-BAILEYS", qrcode: true });
      if (r && (r.status === 200 || r.status === 201)) return { ok: true };
      return falha(r, "Não consegui criar a instância");
    },

    async lerWebhook(): Promise<{ ligado: boolean; url: string | null; eventos: string[] } | null> {
      const r = await chamar("GET", `/webhook/find/${inst}`);
      if (!r || r.status !== 200 || !ehObjeto(r.dados)) return null;
      const w = ehObjeto(r.dados.webhook) ? r.dados.webhook : r.dados;
      const eventos = Array.isArray(w.events) ? w.events.filter((e): e is string => typeof e === "string") : [];
      return { ligado: w.enabled === true, url: texto(w.url), eventos };
    },

    /**
     * O segredo vai no cabeçalho x-webhook-secret e também na URL (?segredo=): nem toda versão da
     * Evolution manda cabeçalho personalizado. Revisar quando a versão instalada for conferida.
     */
    async configurarWebhook(url: string, segredo: string): Promise<{ ok: true } | Falha> {
      const r = await chamar("POST", `/webhook/set/${inst}`, {
        webhook: { enabled: true, url, headers: { "x-webhook-secret": segredo }, byEvents: false, base64: false, events: EVENTOS_DO_WEBHOOK },
      });
      if (r && (r.status === 200 || r.status === 201)) return { ok: true };
      return falha(r, "Não consegui configurar o webhook");
    },
  };
}

export type ClienteEvolution = ReturnType<typeof clienteEvolution>;
