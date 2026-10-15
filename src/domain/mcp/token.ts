import { createHash, randomBytes } from "node:crypto";

// Token de acesso do Claude ao CRM (servidor MCP). O segredo é mostrado uma vez só; no banco
// fica o hash. base64url para poder ir no caminho da URL (conector do claude.ai) sem escape.

const PREFIXO = "oem_";
const FORMATO = /^oem_[A-Za-z0-9_-]{43}$/;

/** 32 bytes aleatórios: "oem_" + 43 caracteres. */
export function gerarToken(): string {
  return PREFIXO + randomBytes(32).toString("base64url");
}

export function hashDoToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// Segredos do OAuth (ADR-017): o código de autorização (uso único, 5 minutos) e o refresh token.
// Prefixos próprios para nunca passarem por token de acesso (pareceToken só aceita "oem_").
const PREFIXOS_OAUTH = { codigo: "oemc_", renovacao: "oemr_" } as const;
const FORMATO_OAUTH = { codigo: /^oemc_[A-Za-z0-9_-]{43}$/, renovacao: /^oemr_[A-Za-z0-9_-]{43}$/ } as const;

export function gerarSegredo(tipo: keyof typeof PREFIXOS_OAUTH): string {
  return PREFIXOS_OAUTH[tipo] + randomBytes(32).toString("base64url");
}

export function pareceSegredo(tipo: keyof typeof PREFIXOS_OAUTH, texto: string | null | undefined): boolean {
  return FORMATO_OAUTH[tipo].test(texto ?? "");
}

/** O começo visível na lista ("oem_" + 6 caracteres): identifica sem revelar. */
export function prefixoDoToken(token: string): string {
  return token.slice(0, PREFIXO.length + 6);
}

/** Formato de um token nosso. Filtra lixo antes de consultar o banco. */
export function pareceToken(texto: string): boolean {
  return FORMATO.test(texto);
}

/** "Bearer <token>" → token; qualquer outra coisa → null. */
export function extrairBearer(cabecalho: string | null | undefined): string | null {
  const m = /^\s*bearer\s+(\S+)\s*$/i.exec(cabecalho ?? "");
  return m ? m[1] : null;
}
