# Épico 1 — Fundação · Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:subagent-driven-development`
> (recommended) or `superpowers:executing-plans` to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deixar o projeto rodando — Next.js + TypeScript, banco via Prisma/Supabase,
login funcionando, e o **padrão TDD estabelecido** com a primeira função de domínio
real testada.

**Architecture:** App único Next.js (App Router) em TypeScript. Lógica de domínio em
funções puras sob `src/domain/`, isoladas de telas e banco. Banco PostgreSQL via
Prisma. Autenticação via Supabase Auth.

**Tech Stack:** Next.js, TypeScript, Tailwind, Prisma, PostgreSQL (Supabase), Supabase
Auth, Vitest, Playwright, ExcelJS, fast-xml-parser.

## Global Constraints

- Linguagem única: **TypeScript** (strict mode ligado).
- Lógica de domínio em **funções puras** sob `src/domain/`, sem dependência de
  Next/Prisma/Supabase.
- **TDD obrigatório:** todo código de produção nasce de um teste que falhou primeiro.
- Banco: **PostgreSQL** (Supabase). ORM: **Prisma**.
- Auditoria: alterações de pedidos/NFes geram `EventoAuditoria` (infra no Épico 2).
- Custo: apenas planos gratuitos (Vercel + Supabase).

---

## Pré-requisito (gate, fora do ciclo TDD): instalar Node.js

Antes da Task 1, o ambiente precisa de **Node.js LTS** (não está instalado).

- [ ] Baixar e instalar **Node.js LTS** de https://nodejs.org (versão LTS, instalador Windows).
- [ ] Verificar: `node --version` (espera v20+ ) e `npm --version`.
- [ ] Criar conta gratuita na **Supabase** (https://supabase.com) e um projeto novo;
  anotar `Project URL`, `anon key` e a `Connection string` (Postgres).

> O agente guia o leigo nesses cliques. Sem Node, nada roda localmente.

---

### Task 1: Scaffold do projeto Next.js + TypeScript + Tailwind

**Files:**
- Create: projeto Next.js na pasta atual (`representacao-comercial/`)
- Create: `.gitignore` (Next.js padrão — inclui `node_modules`, `.next`, `.env*`)

**Interfaces:**
- Produces: app Next.js executável (`npm run dev`), TypeScript strict, Tailwind ativo.

- [ ] **Step 1: Gerar o projeto** (na pasta do projeto, que já tem git e docs/plans)

```bash
npx create-next-app@latest . \
  --typescript --tailwind --eslint --app --src-dir \
  --import-alias "@/*" --no-turbopack --use-npm
```
Responder "yes" para sobrescrever se perguntar (preserva `.git`, `docs/`, `plans/`).

- [ ] **Step 2: Ligar TypeScript strict**

Em `tsconfig.json`, garantir `"strict": true` em `compilerOptions`.

- [ ] **Step 3: Rodar o servidor para verificar**

Run: `npm run dev`
Expected: servidor sobe em `http://localhost:3000` mostrando a página inicial do Next.

- [ ] **Step 4: Ajustar `.gitignore`** para garantir `node_modules/`, `.next/`, `.env*`, `coverage/`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js + TypeScript + Tailwind"
```

---

### Task 2: Infra de testes (Vitest) com o primeiro ciclo RED-GREEN

**Files:**
- Create: `vitest.config.ts`
- Create: `src/domain/__tests__/smoke.test.ts`
- Create: `src/domain/smoke.ts`
- Modify: `package.json` (script `test`)

**Interfaces:**
- Produces: `npm test` rodando Vitest; padrão de teste estabelecido.

- [ ] **Step 1: Instalar Vitest**

```bash
npm install -D vitest
```

- [ ] **Step 2: Escrever o teste que falha**

`src/domain/__tests__/smoke.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { somaConferida } from "../smoke";

describe("infra de testes", () => {
  it("soma dois valores (prova que o TDD está montado)", () => {
    expect(somaConferida(2, 3)).toBe(5);
  });
});
```

- [ ] **Step 3: Configurar Vitest e script**

`vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
export default defineConfig({
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
```
Em `package.json`, adicionar em `"scripts"`: `"test": "vitest run"`, `"test:watch": "vitest"`.

- [ ] **Step 4: Rodar e ver FALHAR (RED)**

Run: `npm test`
Expected: FALHA — `somaConferida` não existe.

- [ ] **Step 5: Implementação mínima (GREEN)**

`src/domain/smoke.ts`:
```ts
export function somaConferida(a: number, b: number): number {
  return a + b;
}
```

- [ ] **Step 6: Rodar e ver PASSAR**

Run: `npm test`
Expected: PASS (1 teste).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "test: configura Vitest e estabelece padrão TDD"
```

---

### Task 3: Primeira função de domínio real — transição de estado do Pedido (TDD)

Estabelece o padrão das máquinas de estado (ADR-005/008) como função pura.

**Files:**
- Create: `src/domain/pedido/estado.ts`
- Test: `src/domain/pedido/__tests__/estado.test.ts`

**Interfaces:**
- Produces:
  - `type EstadoPedido = "SEM_NFE" | "PARCIAL" | "COMPLETO" | "ARQUIVADO"`
  - `function transicaoValida(de: EstadoPedido, para: EstadoPedido): boolean`

- [ ] **Step 1: Escrever os testes que falham**

`src/domain/pedido/__tests__/estado.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { transicaoValida } from "../estado";

describe("transição de estado do pedido", () => {
  it("permite SEM_NFE → PARCIAL", () => {
    expect(transicaoValida("SEM_NFE", "PARCIAL")).toBe(true);
  });
  it("permite PARCIAL → COMPLETO", () => {
    expect(transicaoValida("PARCIAL", "COMPLETO")).toBe(true);
  });
  it("permite COMPLETO → ARQUIVADO e ARQUIVADO → COMPLETO (reversível)", () => {
    expect(transicaoValida("COMPLETO", "ARQUIVADO")).toBe(true);
    expect(transicaoValida("ARQUIVADO", "COMPLETO")).toBe(true);
  });
  it("rejeita SEM_NFE → COMPLETO (pula PARCIAL)", () => {
    expect(transicaoValida("SEM_NFE", "COMPLETO")).toBe(false);
  });
  it("rejeita ARQUIVADO → SEM_NFE", () => {
    expect(transicaoValida("ARQUIVADO", "SEM_NFE")).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e ver FALHAR**

Run: `npm test`
Expected: FALHA — `transicaoValida` não existe.

- [ ] **Step 3: Implementação mínima**

`src/domain/pedido/estado.ts`:
```ts
export type EstadoPedido = "SEM_NFE" | "PARCIAL" | "COMPLETO" | "ARQUIVADO";

const TRANSICOES: Record<EstadoPedido, EstadoPedido[]> = {
  SEM_NFE: ["PARCIAL"],
  PARCIAL: ["COMPLETO"],
  COMPLETO: ["ARQUIVADO"],
  ARQUIVADO: ["COMPLETO"], // reabertura para consulta (RN17)
};

export function transicaoValida(de: EstadoPedido, para: EstadoPedido): boolean {
  return TRANSICOES[de]?.includes(para) ?? false;
}
```

- [ ] **Step 4: Rodar e ver PASSAR**

Run: `npm test`
Expected: PASS (todos os testes de estado).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(domain): transição de estado do pedido com testes (RF07)"
```

---

### Task 4: Banco via Prisma + Supabase (migração inicial)

**Files:**
- Create: `prisma/schema.prisma`
- Create: `.env` (não versionado) e `.env.example` (versionado, sem segredos)
- Create: `src/lib/prisma.ts`
- Test: `src/lib/__tests__/prisma.test.ts`

**Interfaces:**
- Produces: cliente Prisma singleton (`@/lib/prisma`); tabela `Parametro` (guarda
  `prazo_alerta_sem_nfe_dias=7` e `prazo_chamado_critico_dias=30`, ADR-006).

- [ ] **Step 1: Instalar Prisma**

```bash
npm install -D prisma
npm install @prisma/client
npx prisma init --datasource-provider postgresql
```

- [ ] **Step 2: Definir schema mínimo + parâmetros**

`prisma/schema.prisma` (datasource usa `env("DATABASE_URL")`):
```prisma
model Parametro {
  chave String @id
  valor String
}
```
Em `.env`: `DATABASE_URL="<connection string da Supabase>"`. Em `.env.example`:
`DATABASE_URL="postgresql://USER:PASS@HOST:5432/postgres"`.

- [ ] **Step 3: Criar a migração**

Run: `npx prisma migrate dev --name init`
Expected: cria tabela `Parametro` no Postgres da Supabase.

- [ ] **Step 4: Singleton do Prisma + teste de fumaça**

`src/lib/prisma.ts`:
```ts
import { PrismaClient } from "@prisma/client";
const g = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = g.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") g.prisma = prisma;
```

`src/lib/__tests__/prisma.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { prisma } from "../prisma";

describe("conexão Prisma", () => {
  it("conecta e executa uma query trivial", async () => {
    const r = await prisma.$queryRaw`SELECT 1 as ok`;
    expect(r).toBeTruthy();
  });
});
```

- [ ] **Step 5: Rodar e ver PASSAR** (precisa de `DATABASE_URL` válido)

Run: `npm test`
Expected: PASS (conexão ok).

- [ ] **Step 6: Semear os parâmetros padrão**

`prisma/seed.ts` insere `prazo_alerta_sem_nfe_dias=7` e `prazo_chamado_critico_dias=30`.
Rodar: `npx prisma db seed` (configurar `prisma.seed` no package.json).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: Prisma + Postgres (Supabase) + parâmetros padrão (ADR-006)"
```

---

### Task 5: Autenticação (Supabase Auth) + rota protegida + login

**Files:**
- Create: `src/lib/supabase.ts`
- Create: `src/app/login/page.tsx`
- Create: `src/middleware.ts` (protege rotas autenticadas)
- Test: `src/lib/__tests__/auth-guard.test.ts`

**Interfaces:**
- Produces: `function rotaProtegida(pathname: string): boolean` (pura, testável) usada
  pelo middleware; página de login funcional.

- [ ] **Step 1: Instalar SDK**

```bash
npm install @supabase/supabase-js @supabase/ssr
```
`.env`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

- [ ] **Step 2: Teste da regra de proteção (RED)**

`src/lib/__tests__/auth-guard.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { rotaProtegida } from "../auth-guard";

describe("proteção de rotas", () => {
  it("não protege /login", () => {
    expect(rotaProtegida("/login")).toBe(false);
  });
  it("protege /pedidos", () => {
    expect(rotaProtegida("/pedidos")).toBe(true);
  });
});
```

- [ ] **Step 3: Rodar e ver FALHAR**

Run: `npm test`
Expected: FALHA — `rotaProtegida` não existe.

- [ ] **Step 4: Implementar a regra + wiring**

`src/lib/auth-guard.ts`:
```ts
const PUBLICAS = ["/login", "/_next", "/favicon.ico"];
export function rotaProtegida(pathname: string): boolean {
  return !PUBLICAS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}
```
Criar `src/lib/supabase.ts` (cliente browser/server via `@supabase/ssr`),
`src/middleware.ts` (usa `rotaProtegida` + checa sessão Supabase, redireciona p/ `/login`),
e `src/app/login/page.tsx` (form e-mail/senha chamando Supabase Auth).

- [ ] **Step 5: Rodar e ver PASSAR**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Verificar manualmente**

Run: `npm run dev` → acessar `/pedidos` sem login → redireciona para `/login`. Logar →
acessa. (Criar 1 usuário de teste no painel da Supabase.)

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: autenticação Supabase + proteção de rotas (RNF acesso)"
```

---

### Task 6: Casca do app (navegação dos módulos)

**Files:**
- Create: `src/app/(app)/layout.tsx` (layout autenticado com menu lateral)
- Create: `src/components/NavLateral.tsx`
- Create: `src/app/(app)/page.tsx` (placeholder do Dashboard)

**Interfaces:**
- Produces: layout com links para Pedidos, Conferência, Rastreio, Divergências,
  Pedidos×NFE, Alertas, Cadastros (telas reais chegam nos épicos seguintes).

- [ ] **Step 1: Teste da lista de itens do menu (RED)**

`src/components/__tests__/nav.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { ITENS_MENU } from "../nav-itens";

describe("menu lateral", () => {
  it("tem os módulos do MVP em ordem", () => {
    expect(ITENS_MENU.map((i) => i.href)).toEqual([
      "/", "/pedidos", "/conferencia", "/rastreio",
      "/divergencias", "/pedidos-x-nfe", "/alertas", "/cadastros",
    ]);
  });
});
```

- [ ] **Step 2: Rodar e ver FALHAR**

Run: `npm test` → FALHA (`nav-itens` não existe).

- [ ] **Step 3: Implementar**

`src/components/nav-itens.ts`:
```ts
export const ITENS_MENU = [
  { href: "/", rotulo: "Dashboard" },
  { href: "/pedidos", rotulo: "Pedidos" },
  { href: "/conferencia", rotulo: "Conferência NFe" },
  { href: "/rastreio", rotulo: "Rastreio" },
  { href: "/divergencias", rotulo: "Divergências" },
  { href: "/pedidos-x-nfe", rotulo: "Pedidos × NFe" },
  { href: "/alertas", rotulo: "Alertas" },
  { href: "/cadastros", rotulo: "Cadastros" },
] as const;
```
Criar `NavLateral.tsx` consumindo `ITENS_MENU`, `layout.tsx` e `page.tsx` (dashboard placeholder).

- [ ] **Step 4: Rodar e ver PASSAR** → `npm test`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: casca do app com navegação dos módulos"
```

---

### Task 7: Smoke e2e com Playwright

**Files:**
- Create: `playwright.config.ts`
- Create: `e2e/smoke.spec.ts`
- Modify: `package.json` (script `e2e`)

- [ ] **Step 1: Instalar Playwright**

```bash
npm install -D @playwright/test
npx playwright install chromium
```

- [ ] **Step 2: Teste e2e de fumaça (RED)**

`e2e/smoke.spec.ts`:
```ts
import { test, expect } from "@playwright/test";
test("app sobe e redireciona visitante para /login", async ({ page }) => {
  await page.goto("/pedidos");
  await expect(page).toHaveURL(/\/login/);
});
```
`playwright.config.ts`: `baseURL: "http://localhost:3000"`, `webServer` rodando `npm run dev`.
Script: `"e2e": "playwright test"`.

- [ ] **Step 3: Rodar**

Run: `npm run e2e`
Expected: PASS (redireciona para login).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "test(e2e): smoke Playwright do fluxo de login"
```

---

## Self-Review (writing-plans)

- **Cobertura:** Fundação cobre infra de testes (TDD), banco, auth, casca e e2e —
  pré-requisito de todos os RFs. RF07 (transição de pedido) já ancorado na Task 3.
- **Sem placeholders:** todos os steps têm comando/código reais.
- **Consistência de tipos:** `EstadoPedido`/`transicaoValida` (Task 3),
  `rotaProtegida` (Task 5), `ITENS_MENU` (Task 6) são reusados pelos épicos seguintes.

## Definition of Done do Épico 1

`npm run dev` sobe · `npm test` verde · `npm run e2e` verde · login protege rotas ·
padrão TDD demonstrado por uma função de domínio real testada.
