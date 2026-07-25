import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const pkg = JSON.parse(
  readFileSync(path.resolve(__dirname, "../../../package.json"), "utf8"),
) as { scripts: Record<string, string> };

describe("configuração de build", () => {
  // O build da Vercel reaproveita o node_modules em cache entre deploys. Sem um passo
  // explícito de geração, o Prisma Client fica congelado no schema de um deploy antigo
  // e o typecheck quebra em modelos novos (ex.: MotivoChamado).
  it("regenera o Prisma Client em toda instalação de dependências", () => {
    const passos = [pkg.scripts.postinstall, pkg.scripts.build].filter(Boolean).join(" && ");
    expect(passos).toMatch(/prisma\s+generate/);
  });

  // Sem isto, um modelo novo no schema chega à produção sem a tabela correspondente:
  // o build passa e a tela quebra em runtime (foi o caso de HistoricoMensal).
  it("aplica as migrações pendentes antes de compilar", () => {
    expect(pkg.scripts.build).toMatch(/prisma\s+migrate\s+deploy.*&&.*next\s+build/);
  });
});
