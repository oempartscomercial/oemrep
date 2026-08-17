import { describe, it, expect } from "vitest";
import { executarConfirmacao } from "../confirmar";

describe("executarConfirmacao", () => {
  it("devolve null quando a importação conclui sem erros", async () => {
    const mensagem = await executarConfirmacao(async () => ({ erros: [] }));

    expect(mensagem).toBeNull();
  });

  it("junta os erros devolvidos pela action numa mensagem só", async () => {
    const mensagem = await executarConfirmacao(async () => ({
      erros: ["Selecione a fábrica.", "Selecione o cliente."],
    }));

    expect(mensagem).toBe("Selecione a fábrica. Selecione o cliente.");
  });

  it("converte exceção da action em mensagem, em vez de deixar a tela parada", async () => {
    const mensagem = await executarConfirmacao(async () => {
      throw new Error("Failed to fetch");
    });

    expect(mensagem).toBe("Não foi possível concluir a importação. Tente novamente.");
  });
});
