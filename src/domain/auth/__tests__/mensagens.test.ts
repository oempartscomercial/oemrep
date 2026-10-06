import { describe, it, expect } from "vitest";
import { traduzirErroAuth } from "../mensagens";

describe("traduzirErroAuth", () => {
  it("traduz os erros comuns do login", () => {
    expect(traduzirErroAuth({ message: "Invalid login credentials", status: 400 })).toBe("E-mail ou senha incorretos.");
    expect(traduzirErroAuth({ message: "Email not confirmed", status: 400 })).toBe(
      "Seu e-mail ainda não foi confirmado. Fale com o administrador.",
    );
    expect(traduzirErroAuth({ message: "For security purposes, you can only request this after 30 seconds.", status: 429 })).toBe(
      "Muitas tentativas seguidas. Aguarde um pouco e tente de novo.",
    );
  });

  it("traduz erros da troca de senha", () => {
    expect(traduzirErroAuth({ message: "Password should be at least 6 characters.", status: 422 })).toBe(
      "A senha precisa ter pelo menos 6 caracteres.",
    );
    expect(traduzirErroAuth({ message: "New password should be different from the old password.", status: 422 })).toBe(
      "A nova senha precisa ser diferente da atual.",
    );
  });

  it("nunca mostra a mensagem técnica em inglês", () => {
    expect(traduzirErroAuth({ message: "fetch failed" })).toBe("Não foi possível falar com o servidor agora. Tente de novo.");
  });
});
