import { describe, it, expect, vi, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";

const obterUsuarioLogadoMock = vi.fn();
vi.mock("@/lib/sessao", () => ({ obterUsuarioLogado: () => obterUsuarioLogadoMock() }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

import { gerarAcessoClaude, revogarAcessoClaude } from "../actions";

afterEach(() => obterUsuarioLogadoMock.mockReset());

describe("Conectar o Claude — ações da tela", () => {
  it("exige sessão e recusa OPERADOR", async () => {
    obterUsuarioLogadoMock.mockResolvedValue(null);
    expect((await gerarAcessoClaude({ nome: "Claude" })).erros).toEqual(["Sessão expirada. Faça login novamente."]);
    obterUsuarioLogadoMock.mockResolvedValue({ id: "x", nome: "Op", perfil: "OPERADOR", fabricasIds: [] });
    expect((await gerarAcessoClaude({ nome: "Claude" })).erros).toEqual(["Você não tem permissão para acessar o CRM."]);
  });

  it("gera o acesso (token devolvido uma vez) e revoga", async () => {
    const usuario = await prisma.usuario.create({ data: { nome: "Analista Claude", email: "conectar-claude@teste.local", perfil: "ANALISTA" } });
    try {
      obterUsuarioLogadoMock.mockResolvedValue({ id: usuario.id, nome: usuario.nome, perfil: "ANALISTA", fabricasIds: [] });
      const r = await gerarAcessoClaude({ nome: "Claude do Rômulo" });
      expect(r.erros).toEqual([]);
      expect(r.token).toMatch(/^oem_/);
      const salvo = await prisma.tokenApi.findFirstOrThrow({ where: { usuarioId: usuario.id } });
      expect((await revogarAcessoClaude({ id: salvo.id })).erros).toEqual([]);
      expect((await prisma.tokenApi.findUniqueOrThrow({ where: { id: salvo.id } })).revogadoEm).not.toBeNull();
    } finally {
      await prisma.eventoAuditoria.deleteMany({ where: { usuarioId: usuario.id } });
      await prisma.tokenApi.deleteMany({ where: { usuarioId: usuario.id } });
      await prisma.usuario.delete({ where: { id: usuario.id } });
    }
  }, 15000);
});
