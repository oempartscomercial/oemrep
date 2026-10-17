// Chatwoot (caixa de entrada que a Evolution já alimenta). Nesta versão o sistema só guarda a
// configuração e testa a conexão (ADR-019); quem fala com o Chatwoot é a própria Evolution.

export type ConfigChatwoot = { url: string; conta: string; token: string };

export async function testarChatwoot(cfg: ConfigChatwoot, fetchFn: typeof fetch = fetch): Promise<{ ok: true; caixas: string[] } | { ok: false; erro: string }> {
  let r: Response;
  try {
    r = await fetchFn(`${cfg.url.replace(/\/+$/, "")}/api/v1/accounts/${encodeURIComponent(cfg.conta)}/inboxes`, {
      headers: { api_access_token: cfg.token },
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
  } catch {
    return { ok: false, erro: "Não consegui falar com o Chatwoot nesse endereço." };
  }
  if (r.status === 401 || r.status === 403) return { ok: false, erro: "O Chatwoot recusou o token de acesso." };
  if (r.status === 404) return { ok: false, erro: `Não achei a conta ${cfg.conta} no Chatwoot.` };
  if (!r.ok) return { ok: false, erro: `O Chatwoot respondeu ${r.status}.` };
  const dados = (await r.json().catch(() => null)) as { payload?: { name?: unknown }[] } | null;
  const caixas = (dados?.payload ?? []).map((c) => c.name).filter((n): n is string => typeof n === "string");
  return { ok: true, caixas };
}
