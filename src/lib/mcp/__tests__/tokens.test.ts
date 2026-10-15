import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import { hashDoToken } from "@/domain/mcp/token";
import { autenticarToken, criarToken, listarTokens, revogarToken } from "../tokens";

async function cenario(sufixo: string, perfil: "ADMIN" | "ANALISTA" | "OPERADOR" = "ANALISTA") {
  const usuario = await prisma.usuario.create({ data: { nome: `Usuário Token ${sufixo}`, email: `token-${sufixo}@teste.local`, perfil } });
  const sessao = { id: usuario.id, nome: usuario.nome, perfil, fabricasIds: [] as string[] };
  const limpar = async () => {
    await prisma.eventoAuditoria.deleteMany({ where: { usuarioId: usuario.id } });
    await prisma.tokenApi.deleteMany({ where: { usuarioId: usuario.id } });
    await prisma.usuario.delete({ where: { id: usuario.id } });
  };
  return { usuario, sessao, limpar };
}

describe("tokens de acesso do Claude", () => {
  it("cria o token, devolve o segredo uma vez e guarda só o hash, com auditoria", async () => {
    const c = await cenario("t1");
    try {
      const r = await criarToken(c.sessao, "  Claude do Rômulo ");
      expect(r.erros).toEqual([]);
      expect(r.token).toMatch(/^oem_/);
      const salvo = await prisma.tokenApi.findUniqueOrThrow({ where: { id: r.id! } });
      expect(salvo.nome).toBe("Claude do Rômulo");
      expect(salvo.hash).toBe(hashDoToken(r.token!));
      expect(salvo.prefixo).toBe(r.token!.slice(0, 10));
      expect(JSON.stringify(salvo)).not.toContain(r.token!);
      const aud = await prisma.eventoAuditoria.findMany({ where: { entidade: "TokenApi", entidadeId: salvo.id } });
      expect(aud.map((e) => e.campo).sort()).toEqual(["nome", "prefixo"]);
      expect(JSON.stringify(aud)).not.toContain(r.token!);
    } finally {
      await c.limpar();
    }
  }, 15000);

  it("exige nome e recusa quem não usa o CRM", async () => {
    const c = await cenario("t2", "OPERADOR");
    try {
      expect((await criarToken({ ...c.sessao, perfil: "ANALISTA" }, "  ")).erros).toEqual(["Dê um nome ao acesso (ex.: Claude do Rômulo)."]);
      expect((await criarToken(c.sessao, "Claude")).erros).toEqual(["Você não tem permissão para acessar o CRM."]);
      expect(await prisma.tokenApi.count({ where: { usuarioId: c.usuario.id } })).toBe(0);
    } finally {
      await c.limpar();
    }
  }, 15000);

  it("autentica token válido, atualiza o último uso e devolve a sessão do dono", async () => {
    const c = await cenario("t3");
    try {
      const { token } = await criarToken(c.sessao, "Claude");
      const r = await autenticarToken(token!);
      expect(r).toEqual({ ok: true, usuario: { id: c.usuario.id, nome: c.usuario.nome, perfil: "ANALISTA", fabricasIds: [] }, tokenId: expect.any(String) });
      const salvo = await prisma.tokenApi.findFirstOrThrow({ where: { usuarioId: c.usuario.id } });
      expect(salvo.ultimoUsoEm).not.toBeNull();
    } finally {
      await c.limpar();
    }
  }, 15000);

  it("recusa token desconhecido, malformado, revogado ou de usuário desativado (401) e de OPERADOR (403)", async () => {
    const c = await cenario("t4");
    try {
      expect(await autenticarToken("")).toMatchObject({ ok: false, status: 401 });
      expect(await autenticarToken("oem_" + "x".repeat(43))).toMatchObject({ ok: false, status: 401 });
      expect(await autenticarToken("lixo")).toMatchObject({ ok: false, status: 401 });

      const { token, id } = await criarToken(c.sessao, "Claude");
      expect(await revogarToken(c.sessao, id!)).toEqual({ erros: [] });
      expect(await autenticarToken(token!)).toMatchObject({ ok: false, status: 401 });
      const aud = await prisma.eventoAuditoria.findMany({ where: { entidade: "TokenApi", entidadeId: id!, campo: "revogadoEm" } });
      expect(aud).toHaveLength(1);

      const outro = await criarToken(c.sessao, "Claude 2");
      await prisma.usuario.update({ where: { id: c.usuario.id }, data: { perfil: "OPERADOR" } });
      expect(await autenticarToken(outro.token!)).toMatchObject({ ok: false, status: 403 });
      await prisma.usuario.update({ where: { id: c.usuario.id }, data: { perfil: "ANALISTA", ativo: false } });
      expect(await autenticarToken(outro.token!)).toMatchObject({ ok: false, status: 401 });
    } finally {
      await c.limpar();
    }
  }, 15000);

  it("cada um vê e revoga os próprios; ADMIN vê e revoga todos", async () => {
    const a = await cenario("t5a");
    const b = await cenario("t5b");
    const adm = await cenario("t5c", "ADMIN");
    try {
      const ta = await criarToken(a.sessao, "Token A");
      const tb = await criarToken(b.sessao, "Token B");
      expect((await listarTokens(a.sessao)).map((t) => t.nome)).toEqual(["Token A"]);
      expect((await revogarToken(a.sessao, tb.id!)).erros).toEqual(["Acesso não encontrado."]);
      const doAdmin = await listarTokens(adm.sessao);
      expect(doAdmin.map((t) => t.nome)).toEqual(expect.arrayContaining(["Token A", "Token B"]));
      expect(doAdmin.find((t) => t.nome === "Token B")?.dono).toBe(b.usuario.nome);
      expect((await revogarToken(adm.sessao, ta.id!)).erros).toEqual([]);
      expect((await revogarToken(adm.sessao, ta.id!)).erros).toEqual(["Este acesso já estava revogado."]);
      expect(JSON.stringify(doAdmin)).not.toContain("hash");
    } finally {
      await adm.limpar();
      await a.limpar();
      await b.limpar();
    }
  }, 15000);

  it("lista os autorizados pelo OAuth junto, com a origem; parado há mais de 90 dias aparece expirado", async () => {
    const c = await cenario("t6");
    try {
      await criarToken(c.sessao, "Token manual");
      const agora = Date.now();
      const base = { usuarioId: c.usuario.id, origem: "OAUTH" as const, prefixo: "oem_xxxxxx", expiraEm: new Date(agora + 3600_000) };
      await prisma.tokenApi.create({ data: { ...base, nome: "Claude", hash: `h-ok-${agora}`, refreshHash: `r-ok-${agora}`, refreshExpiraEm: new Date(agora + 86400_000) } });
      await prisma.tokenApi.create({ data: { ...base, nome: "Claude Code", hash: `h-velho-${agora}`, refreshHash: `r-velho-${agora}`, refreshExpiraEm: new Date(agora - 1000) } });
      const lista = await listarTokens(c.sessao);
      const por = (nome: string) => lista.find((t) => t.nome === nome)!;
      expect(por("Token manual")).toMatchObject({ origem: "MANUAL", expirado: false });
      expect(por("Claude")).toMatchObject({ origem: "OAUTH", expirado: false });
      expect(por("Claude Code")).toMatchObject({ origem: "OAUTH", expirado: true });
      expect(JSON.stringify(lista)).not.toContain("refresh");
    } finally {
      await c.limpar();
    }
  }, 15000);
});
