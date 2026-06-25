import { describe, it, expect } from "vitest";
import { prisma } from "../prisma";

describe("conexão Prisma", () => {
  it("conecta e executa uma query trivial", async () => {
    const r = await prisma.$queryRaw`SELECT 1 as ok`;
    expect(r).toBeTruthy();
  });
});
