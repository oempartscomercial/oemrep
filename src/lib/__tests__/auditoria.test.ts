import { describe, it, expect } from "vitest";
import { prisma } from "../prisma";
import { registrarAlteracoes } from "../auditoria";

describe("registrarAlteracoes", () => {
  it("grava eventos e cada chamada cria linhas novas (imutável)", async () => {
    const usuario = await prisma.usuario.create({
      data: {
        supabaseUserId: `teste-${Date.now()}`,
        nome: "Usuário Teste",
        email: `teste-${Date.now()}@exemplo.com`,
      },
    });

    await registrarAlteracoes([
      {
        entidade: "Fabrica",
        entidadeId: "fab-x",
        campo: "nome",
        valorAnterior: null,
        valorNovo: "Bowden",
        usuarioId: usuario.id,
      },
    ]);
    await registrarAlteracoes([
      {
        entidade: "Fabrica",
        entidadeId: "fab-x",
        campo: "nome",
        valorAnterior: "Bowden",
        valorNovo: "Bowden Ltda",
        usuarioId: usuario.id,
      },
    ]);

    const eventos = await prisma.eventoAuditoria.findMany({
      where: { entidadeId: "fab-x" },
      orderBy: { criadoEm: "asc" },
    });

    expect(eventos).toHaveLength(2);
    expect(eventos[0].valorNovo).toBe("Bowden"); // primeira gravação intacta
    expect(eventos[1].valorNovo).toBe("Bowden Ltda");

    await prisma.eventoAuditoria.deleteMany({ where: { entidadeId: "fab-x" } });
    await prisma.usuario.delete({ where: { id: usuario.id } });
  });
});
