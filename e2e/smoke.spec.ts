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

test("visitante não logado é redirecionado de /pedidos/importar", async ({ page }) => {
  await page.goto("/pedidos/importar");
  await expect(page).toHaveURL(/\/login/);
});

test("visitante não logado é redirecionado de /rastreio", async ({ page }) => {
  await page.goto("/rastreio");
  await expect(page).toHaveURL(/\/login/);
});

test("visitante não logado é redirecionado de /divergencias", async ({ page }) => {
  await page.goto("/divergencias");
  await expect(page).toHaveURL(/\/login/);
});

test("visitante não logado é redirecionado de /divergencias/nova", async ({ page }) => {
  await page.goto("/divergencias/nova");
  await expect(page).toHaveURL(/\/login/);
});

test("visitante não logado é redirecionado de /pedidos-x-nfe", async ({ page }) => {
  await page.goto("/pedidos-x-nfe");
  await expect(page).toHaveURL(/\/login/);
});

test("visitante não logado é redirecionado de /alertas", async ({ page }) => {
  await page.goto("/alertas");
  await expect(page).toHaveURL(/\/login/);
});

test("visitante não logado é redirecionado de /auditoria", async ({ page }) => {
  await page.goto("/auditoria");
  await expect(page).toHaveURL(/\/login/);
});
