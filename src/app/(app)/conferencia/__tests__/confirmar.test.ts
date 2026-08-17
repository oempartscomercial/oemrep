import { describe, it, expect } from "vitest";
import { executarConfirmacaoBaixa } from "../confirmar";

describe("executarConfirmacaoBaixa", () => {
  it("devolve null quando a baixa conclui sem erros", async () => {
    const mensagem = await executarConfirmacaoBaixa(async () => ({ erros: [] }));

    expect(mensagem).toBeNull();
  });

  it("junta os erros devolvidos pela action numa mensagem só", async () => {
    const mensagem = await executarConfirmacaoBaixa(async () => ({
      erros: ["Sessão expirada. Faça login novamente."],
    }));

    expect(mensagem).toBe("Sessão expirada. Faça login novamente.");
  });

  it("converte exceção da action em mensagem, em vez de deixar a tela parada", async () => {
    const mensagem = await executarConfirmacaoBaixa(async () => {
      throw new Error("Failed to fetch");
    });

    expect(mensagem).toBe("Não foi possível concluir a baixa da NFe. Tente novamente.");
  });
});
