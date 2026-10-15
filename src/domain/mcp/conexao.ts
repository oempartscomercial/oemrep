// O que a pessoa cola para ligar o Claude ao CRM.
// Jeito principal (OAuth, ADR-017): só o endereço do servidor. O Claude descobre o resto, abre
// o navegador na tela de "Permitir" e guarda os tokens sozinho.
// Jeito avançado (token manual, ADR-016), o mesmo token de duas formas:
// - Claude Code: arquivo .mcp.json, com o token no cabeçalho Authorization.
// - claude.ai (conector personalizado): o token vai no caminho da URL (/api/mcp/<token>).

const semBarraFinal = (origem: string) => origem.replace(/\/+$/, "");

export function urlDoServidorMcp(origem: string): string {
  return `${semBarraFinal(origem)}/api/mcp`;
}

export function configuracaoClaudeCodeOAuth(origem: string): string {
  return JSON.stringify({ mcpServers: { oem: { type: "http", url: urlDoServidorMcp(origem) } } }, null, 2);
}

export function configuracaoClaudeCode(origem: string, token: string): string {
  const config = {
    mcpServers: {
      oem: { type: "http", url: urlDoServidorMcp(origem), headers: { Authorization: `Bearer ${token}` } },
    },
  };
  return JSON.stringify(config, null, 2);
}

export function urlDoConector(origem: string, token: string): string {
  return `${urlDoServidorMcp(origem)}/${token}`;
}
