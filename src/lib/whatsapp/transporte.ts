import { randomUUID } from "node:crypto";

// Adaptador de saída (ADR-015 §1): duas operações, enviar e saber se a linha está de pé. O
// resto do sistema só conhece TransporteWhatsapp; trocar a Evolution pela API oficial é
// escrever outro adaptador. Nada aqui decide se pode enviar: isso é de verificarEnvio.

export type EstadoDaLinha = "conectada" | "desconectada" | "desconhecida";

/** `certezaQueNaoEnviou` falso = a resposta se perdeu e a mensagem pode ter saído. Nunca reenviar sozinho. */
export class ErroDeEnvio extends Error {
  constructor(mensagem: string, readonly certezaQueNaoEnviou: boolean) {
    super(mensagem);
  }
}

export interface TransporteWhatsapp {
  nome: string;
  estado(): Promise<EstadoDaLinha>;
  enviarTexto(numeroE164: string, texto: string): Promise<{ idExterno: string }>;
}

const TEMPO_LIMITE_MS = 15_000;

// Rotas da Evolution API v2 (sendText e connectionState). Não conferidas contra o Evolution
// Go nem contra a instância real: confirmar no primeiro teste com número de verdade.
export function criarTransporteEvolution(
  config: { url: string; apikey: string; instancia: string },
  fetchFn: typeof fetch = fetch,
): TransporteWhatsapp {
  const base = config.url.replace(/\/+$/, "");
  const cabecalhos = { apikey: config.apikey, "content-type": "application/json" };
  return {
    nome: "evolution",
    async estado() {
      try {
        const r = await fetchFn(`${base}/instance/connectionState/${config.instancia}`, { headers: cabecalhos, signal: AbortSignal.timeout(TEMPO_LIMITE_MS) });
        if (!r.ok) return "desconhecida";
        const estado = ((await r.json()) as { instance?: { state?: string } }).instance?.state;
        if (estado === "open") return "conectada";
        if (estado === "close") return "desconectada";
        return "desconhecida";
      } catch {
        return "desconhecida";
      }
    },
    async enviarTexto(numeroE164, texto) {
      let r: Response;
      try {
        r = await fetchFn(`${base}/message/sendText/${config.instancia}`, {
          method: "POST",
          headers: cabecalhos,
          body: JSON.stringify({ number: numeroE164.replace(/\D/g, ""), text: texto }),
          signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
        });
      } catch (erro) {
        throw new ErroDeEnvio(`Sem resposta do WhatsApp: ${erro instanceof Error ? erro.message : String(erro)}`, false);
      }
      if (r.status >= 400 && r.status < 500) throw new ErroDeEnvio(`O WhatsApp recusou a mensagem (HTTP ${r.status}).`, true);
      if (!r.ok) throw new ErroDeEnvio(`Erro do WhatsApp (HTTP ${r.status}).`, false);
      const id = ((await r.json().catch(() => ({}))) as { key?: { id?: string } }).key?.id;
      if (!id) throw new ErroDeEnvio("O WhatsApp respondeu sem o id da mensagem.", false);
      return { idExterno: id };
    },
  };
}

/** Para desenvolver sem número: não faz rede e "envia" com id próprio. */
export function criarTransporteSimulado(): TransporteWhatsapp {
  return {
    nome: "simulado",
    estado: async () => "conectada",
    enviarTexto: async () => ({ idExterno: `SIM-${randomUUID()}` }),
  };
}

function criarTransporteDesligado(): TransporteWhatsapp {
  return {
    nome: "desligado",
    estado: async () => "desconectada",
    enviarTexto: async () => {
      throw new ErroDeEnvio("O envio de WhatsApp está desligado neste ambiente.", true);
    },
  };
}

type Ambiente = Record<string, string | undefined>;

// Desligado por padrão. Evolution só liga com tudo configurado E o interruptor
// WHATSAPP_ENVIO_HABILITADO=true; o simulado nunca vale em produção.
export function obterTransporte(env: Ambiente = process.env): TransporteWhatsapp {
  if (env.WHATSAPP_TRANSPORTE === "simulado" && env.NODE_ENV !== "production") return criarTransporteSimulado();
  if (env.WHATSAPP_TRANSPORTE === "evolution" && env.WHATSAPP_ENVIO_HABILITADO === "true") {
    const { EVOLUTION_URL: url, EVOLUTION_APIKEY: apikey, EVOLUTION_INSTANCIA_PROSPECCAO: instancia } = env;
    if (url && apikey && instancia) return criarTransporteEvolution({ url, apikey, instancia });
  }
  return criarTransporteDesligado();
}
