import { createHash, timingSafeEqual } from "node:crypto";

const TAMANHO_MINIMO = 16;

const resumo = (s: string) => createHash("sha256").update(s).digest();

// Compara em tempo constante. Sem segredo configurado, ou curto demais para valer, nada passa.
export function segredoConfere(recebido: string | null, esperado: string | undefined): boolean {
  if (!esperado || esperado.length < TAMANHO_MINIMO || !recebido) return false;
  return timingSafeEqual(resumo(recebido), resumo(esperado));
}

// Cabeçalho x-webhook-secret, Bearer ou ?segredo= (nem todo transporte deixa pôr cabeçalho).
// Na URL o segredo aparece em logs de acesso: prefira o cabeçalho quando der.
export function segredoDaRequisicao(req: Request): string | null {
  const cabecalho = req.headers.get("x-webhook-secret");
  if (cabecalho) return cabecalho;
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7).trim() || null;
  return new URL(req.url).searchParams.get("segredo");
}
