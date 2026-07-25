import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import path from "node:path";
import { ITENS_MENU } from "../nav-itens";

describe("menu lateral", () => {
  it("tem os módulos do MVP em ordem", () => {
    expect(ITENS_MENU.map((i) => i.href)).toEqual([
      "/", "/pedidos", "/conferencia", "/rastreio",
      "/divergencias", "/pedidos-x-nfe", "/alertas", "/auditoria", "/cadastros",
    ]);
  });

  // Um trecho de rota com layout.tsx e sem page.tsx é 404 no App Router. Era o caso
  // de /cadastros, que só tinha as abas filhas (fabricas/clientes/usuarios).
  it("aponta só para rotas que existem", () => {
    const appDir = path.resolve(__dirname, "../../app/(app)");
    const semPagina = ITENS_MENU.filter(
      (item) => !item.href || !existsSync(path.join(appDir, item.href, "page.tsx")),
    ).map((item) => item.href ?? `${item.label} (sem href)`);
    expect(semPagina).toEqual([]);
  });
});
