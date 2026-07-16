import { describe, it, expect } from "vitest";
import { prisma } from "../prisma";
import { obterParametroNumero } from "../parametros";

describe("obterParametroNumero (ADR-006: prazos configuráveis)", () => {
  it("lê o valor numérico gravado no parâmetro", async () => {
    await prisma.parametro.upsert({
      where: { chave: "teste_prazo_dias" },
      update: { valor: "45" },
      create: { chave: "teste_prazo_dias", valor: "45" },
    });

    const valor = await obterParametroNumero("teste_prazo_dias", 10);
    expect(valor).toBe(45);

    await prisma.parametro.delete({ where: { chave: "teste_prazo_dias" } });
  });

  it("usa o padrão quando o parâmetro não existe", async () => {
    const valor = await obterParametroNumero("chave_inexistente_xyz_teste", 30);
    expect(valor).toBe(30);
  });

  it("usa o padrão quando o valor gravado não é numérico", async () => {
    await prisma.parametro.upsert({
      where: { chave: "teste_prazo_invalido" },
      update: { valor: "abc" },
      create: { chave: "teste_prazo_invalido", valor: "abc" },
    });

    const valor = await obterParametroNumero("teste_prazo_invalido", 30);
    expect(valor).toBe(30);

    await prisma.parametro.delete({ where: { chave: "teste_prazo_invalido" } });
  });
});
