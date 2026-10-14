import { describe, it, expect } from "vitest";
import { configuracaoClaudeCode, urlDoConector } from "../conexao";

describe("como conectar o Claude", () => {
  it("monta o bloco do .mcp.json com o endereço e o cabeçalho Authorization", () => {
    const texto = configuracaoClaudeCode("https://oem.exemplo.com.br", "oem_segredo");
    expect(JSON.parse(texto)).toEqual({
      mcpServers: {
        oem: { type: "http", url: "https://oem.exemplo.com.br/api/mcp", headers: { Authorization: "Bearer oem_segredo" } },
      },
    });
    expect(texto).toContain("\n"); // formatado, para ler e colar
  });

  it("monta a URL do conector personalizado do claude.ai com o token no caminho", () => {
    expect(urlDoConector("https://oem.exemplo.com.br", "oem_segredo")).toBe("https://oem.exemplo.com.br/api/mcp/oem_segredo");
  });

  it("ignora a barra final da origem", () => {
    expect(urlDoConector("http://localhost:3000/", "oem_x")).toBe("http://localhost:3000/api/mcp/oem_x");
  });
});
