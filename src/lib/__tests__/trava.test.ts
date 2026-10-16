import { describe, it, expect, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { comTrava } from "../trava";

const CHAVE = `teste:trava:${Date.now()}`;
afterEach(async () => {
  await prisma.trava.deleteMany({ where: { chave: { startsWith: "teste:trava:" } } });
});

describe("comTrava — uma execução por vez", () => {
  it("dois disparos ao mesmo tempo: só um roda a tarefa", async () => {
    let rodando = 0;
    let maximo = 0;
    let vezes = 0;
    const tarefa = async () => {
      rodando += 1;
      vezes += 1;
      maximo = Math.max(maximo, rodando);
      await new Promise((r) => setTimeout(r, 150));
      rodando -= 1;
      return "feito";
    };
    const resultados = await Promise.all([comTrava(CHAVE, 60_000, tarefa), comTrava(CHAVE, 60_000, tarefa), comTrava(CHAVE, 60_000, tarefa)]);
    expect(resultados.filter((r) => r.executou)).toHaveLength(1);
    expect(vezes).toBe(1);
    expect(maximo).toBe(1);
  });

  it("depois que termina (ou se a anterior morreu e a trava venceu), a próxima roda", async () => {
    expect((await comTrava(CHAVE, 60_000, async () => 1)).executou).toBe(true);
    expect(await comTrava(CHAVE, 60_000, async () => 2)).toEqual({ executou: true, resultado: 2 });
    // Execução que "morreu" segurando a trava por pouco tempo.
    await prisma.trava.update({ where: { chave: CHAVE }, data: { dono: "morta", ocupadaAte: new Date(Date.now() + 60_000) } });
    expect((await comTrava(CHAVE, 60_000, async () => 3)).executou).toBe(false);
    await prisma.trava.update({ where: { chave: CHAVE }, data: { ocupadaAte: new Date(Date.now() - 1) } });
    expect((await comTrava(CHAVE, 60_000, async () => 4)).executou).toBe(true);
  });

  it("erro na tarefa solta a trava", async () => {
    await expect(comTrava(CHAVE, 60_000, async () => { throw new Error("falhou"); })).rejects.toThrow("falhou");
    expect((await comTrava(CHAVE, 60_000, async () => "ok")).executou).toBe(true);
  });
});
