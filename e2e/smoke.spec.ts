import { test, expect } from "@playwright/test";
test("app sobe e redireciona visitante para /login", async ({ page }) => {
  await page.goto("/pedidos");
  await expect(page).toHaveURL(/\/login/);
});
