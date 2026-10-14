// O que a pessoa cola para ligar o Claude ao CRM. Duas formas, o mesmo token:
// - Claude Code: arquivo .mcp.json, com o token no cabeçalho Authorization.
// - claude.ai (conector personalizado): não deixa configurar cabeçalho, então o token vai no
//   caminho da URL (/api/mcp/<token>).

const semBarraFinal = (origem: string) => origem.replace(/\/+$/, "");

export function configuracaoClaudeCode(origem: string, token: string): string {
  const config = {
    mcpServers: {
      oem: { type: "http", url: `${semBarraFinal(origem)}/api/mcp`, headers: { Authorization: `Bearer ${token}` } },
    },
  };
  return JSON.stringify(config, null, 2);
}

export function urlDoConector(origem: string, token: string): string {
  return `${semBarraFinal(origem)}/api/mcp/${token}`;
}
