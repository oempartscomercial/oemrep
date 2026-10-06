import { defineConfig } from "vitest/config";
import "dotenv/config";
import path from "node:path";

// A suíte de integração cria e apaga linhas de verdade. Só roda contra banco local
// (npm run test:local), a não ser que TESTES_BANCO_REMOTO=1 seja passado de propósito.
const url = process.env.DATABASE_URL ?? "";
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url) && process.env.TESTES_BANCO_REMOTO !== "1") {
  throw new Error(
    "Testes recusados: DATABASE_URL não aponta para banco local. Use `npm run test:local` " +
      "(ou TESTES_BANCO_REMOTO=1 para rodar contra o banco do .env de propósito).",
  );
}

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
