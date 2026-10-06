import { normalizarTelefone } from "./telefone";

// Adaptador de entrada da Evolution API (ADR-015): traduz o webhook do transporte para
// um evento neutro. O resto do sistema só conhece EventoLido; trocar de transporte (API
// oficial) é escrever outro leitor. Não faz leitura de banco nem rede.
//
// O formato abaixo é o do `messages.upsert` da Evolution API v2 e AINDA NÃO foi conferido
// contra a instância real: por isso o evento bruto é gravado antes de ser lido, e tudo
// que não se entende vira "ignorado" ou "sem_numero" com motivo, nunca some em silêncio.

export type TipoMensagem = "TEXTO" | "AUDIO" | "IMAGEM" | "VIDEO" | "DOCUMENTO" | "OUTRO";

export type EventoLido =
  | {
      tipo: "mensagem";
      idExterno: string;
      numero: string;
      direcao: "ENTRADA" | "SAIDA";
      origem: "CONTATO" | "ROMULO_NO_CELULAR";
      tipoMensagem: TipoMensagem;
      texto: string | null;
      // Nulo quando o transporte não trouxe horário; quem grava decide (usa o de chegada).
      ocorridoEm: Date | null;
      nomeNoWhatsapp: string | null;
    }
  // Conversa individual cujo telefone não dá para saber (ex.: identificador "lid").
  | { tipo: "sem_numero"; idExterno: string; jid: string; motivo: string }
  // Recibo de uma mensagem que enviamos: chegou ao aparelho ou foi lida.
  | { tipo: "status"; idExterno: string; status: "ENTREGUE" | "LIDA" }
  | { tipo: "ignorado"; motivo: string };

type Objeto = Record<string, unknown>;
const ehObjeto = (v: unknown): v is Objeto => typeof v === "object" && v !== null && !Array.isArray(v);
const texto = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v : null);
const ignorado = (motivo: string): EventoLido => ({ tipo: "ignorado", motivo });

const EMBRULHOS = ["ephemeralMessage", "viewOnceMessage", "viewOnceMessageV2", "documentWithCaptionMessage"];

function desembrulhar(mensagem: Objeto): Objeto {
  let atual = mensagem;
  for (let i = 0; i < 3; i++) {
    const nome = EMBRULHOS.find((e) => ehObjeto(atual[e]));
    const dentro = nome ? (atual[nome] as Objeto).message : null;
    if (!ehObjeto(dentro)) break;
    atual = dentro;
  }
  return atual;
}

function conteudo(m: Objeto): { tipoMensagem: TipoMensagem; texto: string | null } | null {
  if (texto(m.conversation)) return { tipoMensagem: "TEXTO", texto: m.conversation as string };
  if (ehObjeto(m.extendedTextMessage) && texto(m.extendedTextMessage.text)) {
    return { tipoMensagem: "TEXTO", texto: m.extendedTextMessage.text as string };
  }
  if (ehObjeto(m.audioMessage)) return { tipoMensagem: "AUDIO", texto: null };
  if (ehObjeto(m.imageMessage)) return { tipoMensagem: "IMAGEM", texto: texto(m.imageMessage.caption) };
  if (ehObjeto(m.videoMessage)) return { tipoMensagem: "VIDEO", texto: texto(m.videoMessage.caption) };
  if (ehObjeto(m.documentMessage)) {
    return { tipoMensagem: "DOCUMENTO", texto: texto(m.documentMessage.caption) ?? texto(m.documentMessage.fileName) };
  }
  // Reação, apagar/editar e chave de grupo não são mensagens para a pessoa.
  const chaves = Object.keys(m).filter((k) => k !== "messageContextInfo" && k !== "senderKeyDistributionMessage");
  if (chaves.length === 0 || chaves.every((k) => k === "reactionMessage" || k === "protocolMessage")) return null;
  return { tipoMensagem: "OUTRO", texto: null };
}

// Horário em segundos: número, texto ou o inteiro de 64 bits do protobuf ({ low, high }).
function lerHorario(v: unknown): Date | null {
  let segundos: number;
  if (typeof v === "number") segundos = v;
  else if (typeof v === "string" && /^\d+$/.test(v)) segundos = Number(v);
  else if (ehObjeto(v) && typeof v.low === "number") segundos = (typeof v.high === "number" ? v.high : 0) * 4_294_967_296 + v.low;
  else return null;
  return Number.isFinite(segundos) && segundos > 0 ? new Date(segundos * 1000) : null;
}

function lerMensagem(data: Objeto): EventoLido {
  const chave = data.key;
  if (!ehObjeto(chave)) return ignorado("mensagem sem chave");
  const jid = texto(chave.remoteJid);
  if (!jid) return ignorado("mensagem sem destinatário");
  if (jid.endsWith("@g.us")) return ignorado("mensagem de grupo");
  if (jid.endsWith("@broadcast") || jid.endsWith("@newsletter")) return ignorado("status ou lista de transmissão");
  const idExterno = texto(chave.id);
  if (!idExterno) return ignorado("mensagem sem id externo");

  if (!ehObjeto(data.message)) return ignorado("mensagem sem conteúdo");
  const lido = conteudo(desembrulhar(data.message));
  if (!lido) return ignorado("reação ou aviso de protocolo");

  // Contas que o WhatsApp esconde atrás de um "lid" às vezes trazem o telefone à parte.
  let numero = normalizarTelefone(jid);
  if (!numero && texto(chave.remoteJidAlt)) numero = normalizarTelefone(chave.remoteJidAlt as string);
  if (!numero) {
    return { tipo: "sem_numero", idExterno, jid, motivo: jid.endsWith("@lid") ? "identificador interno, sem telefone" : "telefone não reconhecido" };
  }

  // Nesta fase nada é enviado pela plataforma; toda mensagem "minha" foi digitada no celular
  // do Rômulo. Quando a fase 2 enviar, o eco da própria mensagem cai na deduplicação por id.
  const minha = chave.fromMe === true;
  return {
    tipo: "mensagem",
    idExterno,
    numero,
    direcao: minha ? "SAIDA" : "ENTRADA",
    origem: minha ? "ROMULO_NO_CELULAR" : "CONTATO",
    tipoMensagem: lido.tipoMensagem,
    texto: lido.texto,
    ocorridoEm: lerHorario(data.messageTimestamp),
    nomeNoWhatsapp: minha ? null : texto(data.pushName),
  };
}

// `messages.update` traz o recibo. O id da mensagem vem em `keyId` (ou `key.id`); "SERVER_ACK"
// só diz que o WhatsApp recebeu, o que já sabemos ao enviar, então não vira status.
const RECIBOS: Record<string, "ENTREGUE" | "LIDA"> = { DELIVERY_ACK: "ENTREGUE", READ: "LIDA", PLAYED: "LIDA" };

function lerRecibo(data: Objeto): EventoLido {
  const status = typeof data.status === "string" ? RECIBOS[data.status.toUpperCase()] : undefined;
  if (!status) return ignorado("recibo sem mudança de estado");
  const id = texto(data.keyId) ?? (ehObjeto(data.key) ? texto(data.key.id) : null);
  if (!id) return ignorado("recibo sem id da mensagem");
  return { tipo: "status", idExterno: id, status };
}

export function lerEventoEvolution(payload: unknown): EventoLido[] {
  if (!ehObjeto(payload)) return [ignorado("corpo não é um evento")];
  const nome = texto(payload.event)?.toLowerCase().replace(/_/g, ".");
  if (!nome) return [ignorado("evento sem nome")];
  if (nome !== "messages.upsert" && nome !== "messages.update") return [ignorado(`evento ${nome}`)];

  const itens = Array.isArray(payload.data) ? payload.data : [payload.data];
  const ler = nome === "messages.update" ? lerRecibo : lerMensagem;
  const lidos = itens.map((d) => (ehObjeto(d) ? ler(d) : ignorado("evento sem dados")));
  return lidos.length > 0 ? lidos : [ignorado("evento sem dados")];
}
