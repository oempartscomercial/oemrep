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
