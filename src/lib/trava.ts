import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Uma execução por vez de uma tarefa agendada (ex.: o cron do WhatsApp chamado a cada 5 minutos).
// Usa uma linha da tabela Trava em vez de advisory lock, que não sobrevive ao pooler do Supabase
// (cada consulta pode ir para uma conexão diferente). Quem consegue empurrar ocupadaAte para o
// futuro roda; se a execução morrer no meio, a trava vence sozinha em `duracaoMs`.

export type ResultadoDaTrava<T> = { executou: true; resultado: T } | { executou: false };

export async function comTrava<T>(chave: string, duracaoMs: number, tarefa: () => Promise<T>): Promise<ResultadoDaTrava<T>> {
  const dono = randomUUID();
  const ate = new Date(Date.now() + duracaoMs);
  try {
    await prisma.trava.create({ data: { chave, dono, ocupadaAte: ate } });
  } catch (erro) {
    if (!(erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002")) throw erro;
    // Já existe: só pega se a anterior venceu. Duas tentativas juntas: o banco deixa uma só passar.
    const pegou = await prisma.trava.updateMany({ where: { chave, ocupadaAte: { lt: new Date() } }, data: { dono, ocupadaAte: ate } });
    if (pegou.count === 0) return { executou: false };
  }
  try {
    return { executou: true, resultado: await tarefa() };
  } finally {
    await prisma.trava.updateMany({ where: { chave, dono }, data: { ocupadaAte: new Date(0) } });
  }
}
