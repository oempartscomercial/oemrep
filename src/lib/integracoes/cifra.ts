import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// Segredos das integrações (API key da Evolution, token do Chatwoot) ficam cifrados no banco com
// AES-256-GCM (ADR-019). A chave mora só na variável INTEGRACOES_CHAVE (Vercel), nunca no banco:
// quem lê o banco sem a variável não lê os segredos. Formato: v1:<iv>:<tag>:<cifrado>, em base64.

const VERSAO = "v1";

export class ErroDeCifra extends Error {}

type Ambiente = Record<string, string | undefined>;

/** 32 bytes em hex (64 caracteres) ou base64 (`openssl rand -base64 32`). Outro formato = sem chave. */
export function lerChave(env: Ambiente = process.env): Buffer | null {
  const valor = env.INTEGRACOES_CHAVE?.trim();
  if (!valor) return null;
  if (/^[0-9a-f]{64}$/i.test(valor)) return Buffer.from(valor, "hex");
  if (!/^[A-Za-z0-9+/_-]+={0,2}$/.test(valor)) return null;
  const bytes = Buffer.from(valor, "base64");
  return bytes.length === 32 ? bytes : null;
}

export function cifrar(texto: string, chave: Buffer): string {
  const iv = randomBytes(12);
  const cifra = createCipheriv("aes-256-gcm", chave, iv);
  const corpo = Buffer.concat([cifra.update(texto, "utf8"), cifra.final()]);
  return [VERSAO, iv.toString("base64"), cifra.getAuthTag().toString("base64"), corpo.toString("base64")].join(":");
}

export function decifrar(cifrado: string, chave: Buffer): string {
  const [versao, iv, tag, corpo] = cifrado.split(":");
  if (versao !== VERSAO || !iv || !tag || corpo === undefined) throw new ErroDeCifra("Segredo salvo em formato desconhecido.");
  try {
    const decifra = createDecipheriv("aes-256-gcm", chave, Buffer.from(iv, "base64"));
    decifra.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([decifra.update(Buffer.from(corpo, "base64")), decifra.final()]).toString("utf8");
  } catch {
    // Chave trocada ou texto adulterado: o GCM recusa. Nunca devolve lixo.
    throw new ErroDeCifra("Não consegui abrir o segredo salvo: a INTEGRACOES_CHAVE mudou? Salve a chave de novo na tela Integrações.");
  }
}
