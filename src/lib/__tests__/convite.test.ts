import { describe, it, expect, vi } from "vitest";
import { enviarConvite, type ClienteDeConvite } from "../convite";

function cliente(erro: { message: string; status?: number; code?: string } | null) {
  const inviteUserByEmail = vi.fn(async () => ({ error: erro }));
  return { inviteUserByEmail, cliente: { auth: { admin: { inviteUserByEmail } } } as ClienteDeConvite };
}

describe("enviarConvite", () => {
  it("convida com o link de volta para a tela de criar senha", async () => {
    const { cliente: c, inviteUserByEmail } = cliente(null);
    expect(await enviarConvite(c, "ana@oem.com.br", "https://oem-rep.vercel.app", "Ana")).toEqual({ ok: true });
    expect(inviteUserByEmail).toHaveBeenCalledWith("ana@oem.com.br", {
      redirectTo: "https://oem-rep.vercel.app/login/nova-senha?tipo=convite",
      data: { nome: "Ana" },
    });
  });

  it("avisa quando a pessoa já tem login, sem texto técnico", async () => {
    const { cliente: c } = cliente({ message: "A user with this email address has already been registered", status: 422, code: "email_exists" });
    const r = await enviarConvite(c, "ana@oem.com.br", "https://x");
    expect(r).toEqual({ ok: false, mensagem: expect.stringContaining("Esqueci minha senha") });
  });

  it("traduz limite de envios do Supabase", async () => {
    const { cliente: c } = cliente({ message: "email rate limit exceeded", status: 429 });
    expect(await enviarConvite(c, "ana@oem.com.br", "https://x")).toEqual({
      ok: false,
      mensagem: "Muitas tentativas seguidas. Aguarde um pouco e tente de novo.",
    });
  });

  it("sem chave de serviço, explica em vez de quebrar", async () => {
    const r = await enviarConvite(null, "ana@oem.com.br", "https://x");
    expect(r.ok).toBe(false);
  });
});
