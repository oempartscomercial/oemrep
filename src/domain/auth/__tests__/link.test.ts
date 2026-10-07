import { describe, it, expect } from "vitest";
import { interpretarLinkDeAcesso, caminhoInterno, tipoDeLinkValido, ehConvite } from "../link";

describe("interpretarLinkDeAcesso", () => {
  it("lê o code do fluxo PKCE (recuperação pedida pelo navegador)", () => {
    expect(interpretarLinkDeAcesso("?code=abc123", "")).toEqual({ tipo: "codigo", codigo: "abc123" });
  });

  it("lê os tokens do fluxo implícito (convite enviado pelo painel ou pela API admin)", () => {
    expect(interpretarLinkDeAcesso("", "#access_token=aaa&refresh_token=rrr&expires_in=3600&token_type=bearer&type=invite")).toEqual({
      tipo: "tokens",
      accessToken: "aaa",
      refreshToken: "rrr",
    });
  });

  it("traduz o erro que o Supabase põe no fragmento quando o link expirou", () => {
    const r = interpretarLinkDeAcesso("", "#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired");
    expect(r).toEqual({ tipo: "erro", mensagem: "Este link expirou ou já foi usado. Peça um novo." });
  });

  it("também entende o erro na query string", () => {
    expect(interpretarLinkDeAcesso("?error=access_denied&error_code=otp_expired", "").tipo).toBe("erro");
  });

  it("token sem refresh_token não é um link utilizável", () => {
    expect(interpretarLinkDeAcesso("", "#access_token=aaa").tipo).toBe("nenhum");
  });

  it("sem nada reconhecível, é nenhum", () => {
    expect(interpretarLinkDeAcesso("", "")).toEqual({ tipo: "nenhum" });
    expect(interpretarLinkDeAcesso("?foo=1", "#bar=2")).toEqual({ tipo: "nenhum" });
  });
});

describe("caminhoInterno (anti open-redirect)", () => {
  it("aceita caminho do próprio site", () => {
    expect(caminhoInterno("/login/nova-senha", "/")).toBe("/login/nova-senha");
    expect(caminhoInterno("/empresas?x=1", "/")).toBe("/empresas?x=1");
  });
  it("recusa o que sairia do site", () => {
    for (const ruim of ["https://evil.com", "//evil.com", "/\\evil.com", "javascript:alert(1)", "evil", ""]) {
      expect(caminhoInterno(ruim, "/")).toBe("/");
    }
    expect(caminhoInterno(null, "/x")).toBe("/x");
  });
});

describe("tipoDeLinkValido", () => {
  it("só aceita os tipos que o Supabase envia por e-mail", () => {
    for (const t of ["invite", "recovery", "email", "magiclink", "signup", "email_change"]) expect(tipoDeLinkValido(t)).toBe(true);
    expect(tipoDeLinkValido("admin")).toBe(false);
    expect(tipoDeLinkValido(null)).toBe(false);
  });
});

describe("ehConvite", () => {
  it("reconhece convite pelo fragmento ou pela query", () => {
    expect(ehConvite("", "#access_token=a&refresh_token=b&type=invite")).toBe(true);
    expect(ehConvite("?tipo=convite", "")).toBe(true);
    expect(ehConvite("?type=invite", "")).toBe(true);
    expect(ehConvite("?code=x", "")).toBe(false);
    expect(ehConvite("", "#type=recovery")).toBe(false);
  });
});
