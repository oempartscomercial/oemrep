import { test, expect } from "@playwright/test";
test("app sobe e redireciona visitante para /login", async ({ page }) => {
  await page.goto("/pedidos");
  await expect(page).toHaveURL(/\/login/);
});

test("visitante não logado é redirecionado de /cadastros/fabricas", async ({ page }) => {
  await page.goto("/cadastros/fabricas");
  await expect(page).toHaveURL(/\/login/);
});

test("visitante não logado é redirecionado de /cadastros/clientes", async ({ page }) => {
  await page.goto("/cadastros/clientes");
  await expect(page).toHaveURL(/\/login/);
});

test("visitante não logado é redirecionado de /cadastros/usuarios", async ({ page }) => {
  await page.goto("/cadastros/usuarios");
  await expect(page).toHaveURL(/\/login/);
});

test("visitante não logado é redirecionado de /pedidos/novo", async ({ page }) => {
  await page.goto("/pedidos/novo");
  await expect(page).toHaveURL(/\/login/);
});
