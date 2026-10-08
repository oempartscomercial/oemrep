import { describe, it, expect, vi } from "vitest";
import { pedirRecuperacao, type ClienteDeRecuperacao } from "../recuperacao";

function cliente(erro: { message: string; status?: number } | null) {
  const resetPasswordForEmail = vi.fn(async () => ({ error: erro }));
  return { resetPasswordForEmail, cliente: { auth: { resetPasswordForEmail } } as ClienteDeRecuperacao };
}

describe("pedirRecuperacao", () => {
  it("manda o link de volta para a tela de criar senha", async () => {
    const { cliente: c, resetPasswordForEmail } = cliente(null);
    expect(await pedirRecuperacao(c, "romulo@oem.com.br", "https://oem-rep.vercel.app")).toEqual({ ok: true });
    expect(resetPasswordForEmail).toHaveBeenCalledWith("romulo@oem.com.br", { redirectTo: "https://oem-rep.vercel.app/login/nova-senha" });
  });

  it("traduz limite de envios do Supabase", async () => {
    const { cliente: c } = cliente({ message: "email rate limit exceeded", status: 429 });
    expect(await pedirRecuperacao(c, "romulo@oem.com.br", "https://x")).toEqual({
      ok: false,
      mensagem: "Muitas tentativas seguidas. Aguarde um pouco e tente de novo.",
    });
  });

  it("sem configuração, explica em vez de quebrar", async () => {
    const r = await pedirRecuperacao(null, "romulo@oem.com.br", "https://x");
    expect(r.ok).toBe(false);
  });
});
