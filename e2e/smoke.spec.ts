import { test, expect } from "@playwright/test";
test("app sobe e redireciona visitante para /login", async ({ page }) => {
  await page.goto("/pedidos");
  await expect(page).toHaveURL(/\/login/);
});

test("visitante não logado é redirecionado de /cadastros/fabricas", async ({ page }) => {
  await page.goto("/cadastros/fabricas");
  await expect(page).toHaveURL(/\/login/);
});
