# Migração para Untitled UI React (OSS/MIT) — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para implementar tarefa a tarefa. Os passos usam checkbox (`- [ ]`).

**Goal:** Substituir o shadcn/ui pelo Untitled UI React OSS (MIT) como design system único, migrando as 18 telas para a identidade grafite+vermelho da OEM, sem alterar regra de negócio, rota, API, permissão, máquina de estado ou auditoria.

**Architecture:** Tokens do Untitled UI em `src/styles/theme.css` (rebrand: `--color-brand-*` → grafite; `--color-red-*` mantido = vermelho OEM = alertas). Componentes reais (MIT) trazidos via `npx untitledui@latest add`, organizados em `src/components/{ui,application,patterns,layouts}`. Telas reescritas na camada de apresentação, preservando handlers/props/dados. React Aria substitui Base UI.

**Tech Stack:** Next 16 (App Router, `src/`), React 19, TypeScript strict, Tailwind v4, Untitled UI OSS, React Aria Components, `@untitledui/icons`, Vitest, Playwright.

## Global Constraints

- **Só tema claro.** Remover/neutralizar blocos dark (`.dark-mode`); não estilizar dark.
- **Cor primária = grafite** (`--color-brand-600` ≈ `rgb(57 57 64)`, `-700` hover). **Vermelho** (`--color-red-*`, `-600` ≈ `#D92D20`) = logo, alertas, destrutivo. **Fundo branco.**
- **Fonte = Inter** (`next/font/google`, variável `--font-inter`).
- **Só componentes OSS/MIT.** Proibido Pro/Figma pago. Proibido misturar shadcn default, Origin UI, ReUI, Tremor, Mantine.
- **Não alterar** `src/domain/**`, `src/app/api/**`, `src/lib/**` (Prisma), permissões (ADR-009), estados (ADR-005/008), auditoria. Só apresentação.
- **Imports adaptados:** util em `@/lib/cx` (reexporta `cx`/`sortCx`); componentes em `@/components/...`; ícones `@untitledui/icons`.
- **Commits pequenos**, um por tarefa/subtarefa concluída, em português.
- **DoD por tarefa:** `npx tsc --noEmit` passa e `npm test` continua verde antes do commit.
- **Referência local:** projeto OSS completo já extraído em
  `<scratchpad>/uui-probe` (fonte dos arquivos reais quando o `add` não bastar).

---

### Task 1: Fundação — dependências, tokens e utilitários

**Files:**
- Modify: `package.json` (deps)
- Create: `src/styles/theme.css`, `src/styles/typography.css`, `src/lib/cx.ts`, `src/providers/router-provider.tsx`
- Modify: `src/app/globals.css`, `src/app/layout.tsx`, `src/lib/utils.ts`
- Create (scaffold vazio com `.gitkeep`): `src/components/ui/`, `src/components/application/`, `src/components/patterns/`, `src/components/layouts/`
- Asset: `public/oem-logo.png` (a logo enviada pelo cliente)

**Interfaces:**
- Produces: `cx(...classes)` e `sortCx(obj)` em `@/lib/cx`; tokens Tailwind (`bg-brand-solid`, `text-primary`, `text-error-primary`, `bg-primary`, `border-primary`, `text-display-sm`, etc.); `RouteProvider` para React Aria + Next router.

- [ ] **Step 1: Instalar dependências**

```bash
npm i react-aria-components@^1.16.0 tailwindcss-react-aria-components@^2.0.1 tailwindcss-animate@^1.0.7 @tailwindcss/typography@^0.5.19 @untitledui/icons@^0.0.22
```

- [ ] **Step 2: Copiar tokens reais da referência e aplicar rebrand**

Copiar `theme.css` e `typography.css` da referência para `src/styles/`:

```bash
UUI=<scratchpad>/uui-probe/src/styles
cp "$UUI/theme.css" src/styles/theme.css
cp "$UUI/typography.css" src/styles/typography.css
```

Editar `src/styles/theme.css` — substituir o bloco `--color-brand-*` (violeta) por grafite:

```css
    --color-brand-50: rgb(247 247 248);
    --color-brand-100: rgb(238 238 240);
    --color-brand-200: rgb(220 220 224);
    --color-brand-300: rgb(188 188 194);
    --color-brand-400: rgb(140 140 148);
    --color-brand-500: rgb(93 93 102);
    --color-brand-600: rgb(57 57 64);
    --color-brand-700: rgb(40 40 46);
    --color-brand-800: rgb(28 28 33);
    --color-brand-900: rgb(20 20 24);
    --color-brand-950: rgb(12 12 14);
```

Manter `--color-red-*` como está (já ≈ vermelho OEM). Não editar dark mode (fora de escopo; fica inerte porque nunca aplicamos `.dark-mode`).

- [ ] **Step 3: Reescrever `globals.css`**

```css
@import "tailwindcss";
@import "../styles/theme.css";
@import "../styles/typography.css";

@plugin "@tailwindcss/typography";
@plugin "tailwindcss-react-aria-components";
@plugin "tailwindcss-animate";

@custom-variant label (& [data-label]);
@custom-variant focus-input-within (&:has(input:focus));

@utility scrollbar-hide {
    &::-webkit-scrollbar { display: none; -webkit-appearance: none; }
    -ms-overflow-style: none;
    scrollbar-width: none;
}

html, body {
    font-family: var(--font-body);
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
}
input::-webkit-outer-spin-button, input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
input[type="number"] { -moz-appearance: textfield; }
```

(Removidos: `@import "shadcn/tailwind.css"`, `tw-animate-css`, blocos `@theme inline` do shadcn, `:root`/`.dark` do shadcn, `@custom-variant dark`.)

- [ ] **Step 4: Criar `src/lib/cx.ts`** (copiado da referência `utils/cx.ts`, com `sortCx`):

```ts
import { extendTailwindMerge } from "tailwind-merge";

const twMerge = extendTailwindMerge({
    extend: { theme: { text: ["display-xs", "display-sm", "display-md", "display-lg", "display-xl", "display-2xl"] } },
});

export const cx = twMerge;
export function sortCx<T extends Record<string, unknown>>(classes: T): T { return classes; }
```

Manter `src/lib/utils.ts` reexportando para não quebrar imports existentes durante a migração:

```ts
export { cx, cx as cn, sortCx } from "./cx";
```

- [ ] **Step 5: Criar `src/providers/router-provider.tsx`** (integra React Aria ao Next):

```tsx
"use client";
import { useRouter } from "next/navigation";
import { RouterProvider } from "react-aria-components";

declare module "react-aria-components" {
    interface RouterConfig { routerOptions: NonNullable<Parameters<ReturnType<typeof useRouter>["push"]>[1]>; }
}

export function RouteProvider({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    return <RouterProvider navigate={router.push}>{children}</RouterProvider>;
}
```

- [ ] **Step 6: Atualizar `src/app/layout.tsx`** — Inter + RouteProvider + fundo branco, `lang="pt-BR"`, sem dark:

```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { RouteProvider } from "@/providers/router-provider";
import "./globals.css";
import { cx } from "@/lib/cx";

const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter" });

export const metadata: Metadata = { title: "OEM Representações", description: "Gestão de representação comercial" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    return (
        <html lang="pt-BR">
            <body className={cx(inter.variable, "bg-primary text-primary antialiased")}>
                <RouteProvider>{children}</RouteProvider>
            </body>
        </html>
    );
}
```

(Preservar quaisquer providers/auth já presentes no layout atual — ler antes de sobrescrever.)

- [ ] **Step 7: Scaffold de pastas + salvar logo**

```bash
mkdir -p src/components/{ui,application,patterns,layouts} src/hooks
touch src/components/ui/.gitkeep src/components/application/.gitkeep src/components/patterns/.gitkeep src/components/layouts/.gitkeep
# salvar a imagem enviada pelo cliente como public/oem-logo.png
```

- [ ] **Step 8: Verificar build de estilos e tipos**

Run: `npx tsc --noEmit` → Expected: PASS (nenhum erro novo). O app ainda usa componentes shadcn antigos aqui — ok, coexistência temporária.

- [ ] **Step 9: Commit**

```bash
git add -A && git commit -m "feat(ds): fundação Untitled UI — tokens grafite+vermelho, cx, provider, fontes"
```

---

### Task 2: Componentes base (`src/components/ui/`)

**Files:**
- Create: `src/components/ui/button.tsx`, `input.tsx`, `label.tsx`, `hint-text.tsx`, `textarea.tsx`, `select.tsx`, `checkbox.tsx`, `badge.tsx`, `dropdown.tsx`, `tooltip.tsx`, `form.tsx` (e dependências diretas que cada um exigir)
- Test: `src/components/ui/__tests__/badge.render.test.tsx`

**Interfaces:**
- Produces: `Button` (props: `color?: "primary"|"secondary"|"tertiary"|"link-gray"|"link-color"; size?; iconLeading?; iconTrailing?; isLoading?; isDisabled?`), `Input`, `Label`, `Badge` (props `color`, `size`, `type`), `Select`, `Checkbox`, `Textarea`, `Tooltip`, `Dropdown`, `Form` — API real do Untitled UI (React Aria).

- [ ] **Step 1: Trazer os componentes base reais**

Preferir o CLI (resolve dependências). No diretório do projeto:

```bash
npx untitledui@latest add button input label textarea select checkbox badges dropdown tooltip form -y
```

Se o CLI colocar em caminho diferente (ex.: `src/components/base/...`), mover para `src/components/ui/` e achatar subpastas simples. Fallback: copiar de `<scratchpad>/uui-probe/src/components/base/<comp>/*.tsx`.

- [ ] **Step 2: Reescrever imports internos para os aliases do projeto**

Em todos os arquivos trazidos, aplicar:
- `@/utils/cx` → `@/lib/cx`
- `@/components/base/<x>` → `@/components/ui/<x>` (quando movido)
- manter `@/hooks/*` (copiar hooks usados de `<scratchpad>/uui-probe/src/hooks` para `src/hooks`)
- `@/utils/is-react-component` → copiar para `src/lib/is-react-component.ts` e apontar

Comando base (repetir por arquivo ou via find):
```bash
grep -rl "@/utils/cx" src/components/ui | xargs sed -i '' 's#@/utils/cx#@/lib/cx#g'
```

- [ ] **Step 3: Teste de fumaça (render) do Badge — garante que a stack React Aria compila e renderiza**

```tsx
// src/components/ui/__tests__/badge.render.test.tsx
import { render, screen } from "@testing-library/react";
import { Badge } from "@/components/ui/badge";

test("Badge renderiza o texto", () => {
  render(<Badge color="success">COMPLETO</Badge>);
  expect(screen.getByText("COMPLETO")).toBeInTheDocument();
});
```

(Se `@testing-library/react` não estiver instalado: `npm i -D @testing-library/react @testing-library/jest-dom jsdom` e garantir `environment: "jsdom"` no `vitest.config`. Verificar config atual antes.)

- [ ] **Step 4: Rodar o teste** — `npx vitest run src/components/ui/__tests__/badge.render.test.tsx` → PASS.

- [ ] **Step 5: `npx tsc --noEmit`** → PASS.

- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat(ds): componentes base ui (button/input/select/badge/…)"`

---

### Task 3: Componentes de aplicação (`src/components/application/`)

**Files:**
- Create: `src/components/application/table/*`, `tabs/*`, `modal/*`, `pagination/*`, `empty-state/*`, `file-upload/*`, `app-navigation/*` (sidebar), e `src/components/foundations/featured-icon/*`

**Interfaces:**
- Produces: `Table` (+ `TableCard`, `Table.Header`, `Table.Row`, `Table.Cell` conforme API real), `Tabs`, `Modal`/`Dialog`, `PaginationPageDefault`/`Pagination`, `EmptyState`, `FileUpload`, `SidebarNavigationSimple` (props: `items`, `activeUrl`).

- [ ] **Step 1: Trazer componentes de aplicação**

```bash
npx untitledui@latest add table tabs modal pagination empty-state file-upload sidebar-navigation featured-icon -y
```

Fallback: copiar de `<scratchpad>/uui-probe/src/components/application/*` e `.../foundations/featured-icon/*`.

- [ ] **Step 2: Reescrever imports** (mesmas regras da Task 2, Step 2). Copiar hooks necessários (`use-breakpoint.ts`, `use-resize-observer.ts`) para `src/hooks`.

- [ ] **Step 3: `npx tsc --noEmit`** → PASS.

- [ ] **Step 4: Commit** — `git add -A && git commit -m "feat(ds): componentes de aplicação (table/tabs/modal/sidebar/…)"`

---

### Task 4: Patterns do produto (`src/components/patterns/`)

**Files:**
- Create: `src/components/patterns/status-badge.tsx`, `page-header.tsx`, `data-table.tsx`, `form-field.tsx`, `filtros-bar.tsx`, `timeline.tsx`
- Test: `src/components/patterns/__tests__/status-badge.test.ts`

**Interfaces:**
- Consumes: `Badge` (Task 2), `Table` (Task 3).
- Produces:
  - `statusBadgeConfig(tipo, valor) => { label: string; color: BadgeColor }` (função pura)
  - `<StatusBadge tipo="pedido"|"nfe"|"chamado" valor={string} />`
  - `<PageHeader titulo descricao? acoes? />`
  - `<DataTable ...>` wrapper, `<FormField label erro? dica?>{control}</FormField>`, `<FiltrosBar/>`, `<Timeline eventos={...} />`

- [ ] **Step 1: Escrever teste da lógica pura do StatusBadge (RED)**

```ts
// src/components/patterns/__tests__/status-badge.test.ts
import { statusBadgeConfig } from "@/components/patterns/status-badge";

test("pedido COMPLETO → verde", () => {
  expect(statusBadgeConfig("pedido", "COMPLETO")).toEqual({ label: "Completo", color: "success" });
});
test("pedido SEM_NFE → cinza", () => {
  expect(statusBadgeConfig("pedido", "SEM_NFE")).toEqual({ label: "Sem NFe", color: "gray" });
});
test("pedido PARCIAL → âmbar", () => {
  expect(statusBadgeConfig("pedido", "PARCIAL")).toEqual({ label: "Parcial", color: "warning" });
});
test("nfe EXTRAVIADO → vermelho (alerta)", () => {
  expect(statusBadgeConfig("nfe", "EXTRAVIADO")).toEqual({ label: "Extraviado", color: "error" });
});
test("nfe TRANSITO → azul", () => {
  expect(statusBadgeConfig("nfe", "TRANSITO")).toEqual({ label: "Em trânsito", color: "blue" });
});
test("valor desconhecido → cinza com o próprio texto", () => {
  expect(statusBadgeConfig("pedido", "XPTO")).toEqual({ label: "XPTO", color: "gray" });
});
```

- [ ] **Step 2: Rodar (RED)** — `npx vitest run src/components/patterns/__tests__/status-badge.test.ts` → FAIL ("statusBadgeConfig is not defined").

- [ ] **Step 3: Implementar `status-badge.tsx` (GREEN)**

```tsx
import { Badge } from "@/components/ui/badge";

type BadgeColor = "gray" | "success" | "warning" | "error" | "blue";
type Tipo = "pedido" | "nfe" | "chamado";

const MAPA: Record<Tipo, Record<string, { label: string; color: BadgeColor }>> = {
  pedido: {
    SEM_NFE: { label: "Sem NFe", color: "gray" },
    PARCIAL: { label: "Parcial", color: "warning" },
    COMPLETO: { label: "Completo", color: "success" },
    ARQUIVADO: { label: "Arquivado", color: "gray" },
  },
  nfe: {
    TRANSITO: { label: "Em trânsito", color: "blue" },
    RECEBIDA: { label: "Recebida", color: "warning" },
    ARMAZENADA: { label: "Armazenada", color: "success" },
    EXTRAVIADO: { label: "Extraviado", color: "error" },
  },
  chamado: {
    ABERTO: { label: "Aberto", color: "blue" },
    EM_TRATATIVA: { label: "Em tratativa", color: "warning" },
    AGUARDANDO: { label: "Aguardando", color: "warning" },
    RESOLVIDO: { label: "Resolvido", color: "success" },
  },
};

export function statusBadgeConfig(tipo: Tipo, valor: string): { label: string; color: BadgeColor } {
  return MAPA[tipo]?.[valor] ?? { label: valor, color: "gray" };
}

export function StatusBadge({ tipo, valor }: { tipo: Tipo; valor: string }) {
  const { label, color } = statusBadgeConfig(tipo, valor);
  return <Badge color={color} type="pill-color" size="sm">{label}</Badge>;
}
```

(Ajustar `type`/props ao API real do `Badge` trazido; se `color` não aceitar `"blue"`, mapear para o utility color correspondente.)

- [ ] **Step 4: Rodar (GREEN)** — mesmo comando → PASS.

- [ ] **Step 5: Implementar os demais patterns** (`PageHeader`, `DataTable`, `FormField`, `FiltrosBar`, `Timeline`) como composições finas sobre `ui/` e `application/`. Sem lógica de negócio.

Exemplo `page-header.tsx`:
```tsx
export function PageHeader({ titulo, descricao, acoes }: { titulo: string; descricao?: string; acoes?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 border-b border-secondary pb-5 md:flex-row md:items-center md:justify-between">
      <div>
        <h1 className="text-display-xs font-semibold text-primary">{titulo}</h1>
        {descricao && <p className="mt-1 text-md text-tertiary">{descricao}</p>}
      </div>
      {acoes && <div className="flex gap-3">{acoes}</div>}
    </div>
  );
}
```

- [ ] **Step 6: `npx tsc --noEmit`** → PASS.

- [ ] **Step 7: Commit** — `git add -A && git commit -m "feat(ds): patterns (StatusBadge TDD, PageHeader, DataTable, Timeline…)"`

---

### Task 5: Layouts + shell da aplicação

**Files:**
- Create: `src/components/layouts/app-shell.tsx`, `auth-layout.tsx`, `page-container.tsx`
- Modify: `src/app/(app)/layout.tsx`
- Modify/replace: `src/components/NavLateral.tsx` (substituído pelo shell), `src/components/nav-itens.ts` (mantido; adaptar formato para o Sidebar do Untitled)

**Interfaces:**
- Consumes: `SidebarNavigationSimple` (Task 3), `nav-itens.ts` (`ITENS_MENU`).
- Produces: `<AppShell>{children}</AppShell>` (sidebar responsiva + área de conteúdo), `<AuthLayout>`, `<PageContainer>`.

- [ ] **Step 1: Adaptar `nav-itens.ts`** ao formato do sidebar (adicionar ícones de `@untitledui/icons`):

```ts
import { Home01, Package, FileCheck02, Truck01, AlertTriangle, BarChartSquare02, Bell01, Settings01 } from "@untitledui/icons";
export const ITENS_MENU = [
  { href: "/", label: "Dashboard", icon: Home01 },
  { href: "/pedidos", label: "Pedidos", icon: Package },
  { href: "/conferencia", label: "Conferência NFe", icon: FileCheck02 },
  { href: "/rastreio", label: "Rastreio", icon: Truck01 },
  { href: "/divergencias", label: "Divergências", icon: AlertTriangle },
  { href: "/pedidos-x-nfe", label: "Pedidos × NFe", icon: BarChartSquare02 },
  { href: "/alertas", label: "Alertas", icon: Bell01 },
  { href: "/cadastros", label: "Cadastros", icon: Settings01 },
] as const;
```
(Confirmar os nomes reais dos ícones em `@untitledui/icons` antes; ajustar se necessário.)

- [ ] **Step 2: Criar `app-shell.tsx`** usando o `SidebarNavigationSimple` real, com a logo OEM no topo e destaque **vermelho** no item ativo (accent da marca):

```tsx
"use client";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { SidebarNavigationSimple } from "@/components/application/app-navigation/sidebar-navigation/sidebar-simple";
import { ITENS_MENU } from "@/components/nav-itens";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="flex h-dvh bg-primary">
      <SidebarNavigationSimple
        activeUrl={pathname}
        items={ITENS_MENU.map((i) => ({ label: i.label, href: i.href, icon: i.icon }))}
        // logo: <Image src="/oem-logo.png" alt="OEM Representações" width={140} height={40} priority />
      />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
```
(Ajustar props ao API real do sidebar; injetar a logo pelo slot/props que o componente expõe. Item ativo recebe accent vermelho — via prop de cor ou override `text-error-primary`/borda vermelha.)

- [ ] **Step 3: Migrar `src/app/(app)/layout.tsx`** para usar `<AppShell>` (preservando qualquer verificação de auth/servidor existente — ler antes).

- [ ] **Step 4: Criar `auth-layout.tsx` e `page-container.tsx`** (moldura de login; container com `max-w-container` e paddings padrão).

- [ ] **Step 5: Verificação visual do shell** — subir o dev server e conferir a navegação:

```
preview_start {name:"dev"}  (criar .claude/launch.json se não existir: next dev, porta 3000)
navigate para /pedidos ; read_page ; screenshot
```
Conferir: sidebar renderiza, item ativo em vermelho, logo visível, sem erro no console.

- [ ] **Step 6: `npx tsc --noEmit`** → PASS. Remover `NavLateral.tsx` antigo se não mais referenciado.

- [ ] **Step 7: Commit** — `git add -A && git commit -m "feat(ds): shell do app com sidebar Untitled UI + logo OEM"`

---

### Task 6: Tela de Login

**Files:** Modify `src/app/login/page.tsx` (+ componentes de form dessa tela). Usar `AuthLayout`, `Input`, `Label`, `Button`, `FormField`.

- [ ] **Step 1:** Ler a tela atual e listar campos/handlers/validações/ações (preservar 100% da lógica de auth Supabase).
- [ ] **Step 2:** Reescrever o JSX com componentes Untitled UI + `AuthLayout`, mantendo `name`/`id`/`type`/handlers.
- [ ] **Step 3: Verificação** — `navigate /login`; `read_page`; screenshot; console sem erro. Testar submit com credenciais inválidas (deve manter o comportamento atual).
- [ ] **Step 4:** `npx tsc --noEmit` + `npm test` → PASS.
- [ ] **Step 5: Commit** — `git commit -am "feat(ds): migra tela de login para Untitled UI"`

---

### Task 7: Dashboard

**Files:** Modify `src/app/(app)/page.tsx` (+ componentes locais). Usar `PageHeader`, `Card`/superfícies, `Badge`.

- [ ] **Step 1:** Ler a tela atual; inventariar blocos (cards de resumo, listas, links).
- [ ] **Step 2:** Reescrever com `PageContainer` + `PageHeader` + grid de cartões Untitled UI. Preservar os dados/consultas.
- [ ] **Step 3: Verificação** — `navigate /`; screenshot desktop; sem erro no console.
- [ ] **Step 4:** `npx tsc --noEmit` + `npm test` → PASS.
- [ ] **Step 5: Commit** — `git commit -am "feat(ds): migra dashboard para Untitled UI"`

---

### Task 8: Pedidos (lista, novo, importar, detalhe)

**Files:** Modify `src/app/(app)/pedidos/page.tsx`, `pedidos/novo/page.tsx`, `pedidos/importar/page.tsx`, `pedidos/[id]/page.tsx` (+ componentes locais dessas telas).

**Interfaces:** Consumes `DataTable`, `StatusBadge`, `FiltrosBar`, `PageHeader`, `Tabs`, `FormField`, `FileUpload`, `Modal`.

- [ ] **Step 1 (lista):** Reescrever a tabela de pedidos com `DataTable` + `StatusBadge` (situação) + `FiltrosBar` (filtro por situação). Preservar colunas, ordenação, links de linha e a filtragem.
- [ ] **Step 2 (novo):** Formulário de criação (inclui `S/N`) com `FormField`/`Input`/`Select`/`Button`. Preservar validação e submit.
- [ ] **Step 3 (importar):** Fluxo upload→revisão→confirmação com `FileUpload`, tabela de revisão e `Button`/`Modal` de confirmação. Preservar o parse/preview e a confirmação.
- [ ] **Step 4 (detalhe):** Abas Itens/Notas fiscais/Histórico com `Tabs`; `StatusBadge` nos itens/nota; ações de status e arquivar/reabrir com `Button`/`Modal`. Preservar todas as ações e a auditoria.
- [ ] **Step 5: Verificação** — navegar por cada rota; `read_page`; screenshots; console limpo; testar um filtro e uma ação.
- [ ] **Step 6:** `npx tsc --noEmit` + `npm test` + `npm run e2e -- pedidos` (ajustar seletores quebrados por *role*/texto) → PASS.
- [ ] **Step 7: Commit** — `git commit -am "feat(ds): migra telas de Pedidos para Untitled UI"` (pode commitar por subtela)

---

### Task 9: Conferência de NFe (lista, detalhe)

**Files:** Modify `src/app/(app)/conferencia/page.tsx`, `conferencia/[id]/page.tsx` (+ componentes locais).

- [ ] **Step 1 (lista/entrada):** upload de XML com `FileUpload`; lista/estado com `DataTable`/`EmptyState`.
- [ ] **Step 2 (detalhe/conferência):** grade de divergências item a item com `Table` + destaque **vermelho** para divergência; confirmação manual da baixa com `Button`/`Modal`. Preservar RN04/RF15/RF16 e a auditoria da baixa.
- [ ] **Step 3: Verificação** — navegar; screenshots; console limpo; conferir que divergências aparecem em vermelho.
- [ ] **Step 4:** `npx tsc --noEmit` + `npm test` + `npm run e2e -- conferencia` → PASS.
- [ ] **Step 5: Commit** — `git commit -am "feat(ds): migra Conferência de NFe para Untitled UI"`

---

### Task 10: Cadastros (fábricas, clientes, usuários + formulários)

**Files:** Modify `src/app/(app)/cadastros/layout.tsx`, `cadastros/fabricas/page.tsx` + `fabricas/novo/page.tsx`, `cadastros/clientes/page.tsx` + `clientes/novo/page.tsx`, `cadastros/usuarios/page.tsx` + `usuarios/novo/page.tsx`.

- [ ] **Step 1:** `cadastros/layout.tsx` — sub-navegação (Tabs ou nav secundária Untitled UI) preservando as sub-rotas.
- [ ] **Step 2:** Três listas com `DataTable`/`Badge` (ex.: fábricas permitidas do usuário, cliente multi-fábrica).
- [ ] **Step 3:** Três formulários (`FormField`/`Input`/`Select`/`Checkbox`) preservando validação de CNPJ, multi-fábrica do cliente e permissão por fábrica do usuário (ADR-009/010). Não tocar na lógica de domínio.
- [ ] **Step 4: Verificação** — navegar pelas 6 telas; screenshots; console limpo; validar um CNPJ inválido (mensagem de erro em vermelho).
- [ ] **Step 5:** `npx tsc --noEmit` + `npm test` + `npm run e2e -- cadastros` → PASS.
- [ ] **Step 6: Commit** — `git commit -am "feat(ds): migra Cadastros (fábricas/clientes/usuários) para Untitled UI"`

---

### Task 11: Rastreio (lista, detalhe)

**Files:** Modify `src/app/(app)/rastreio/page.tsx`, `rastreio/[id]/page.tsx` (+ componentes locais).

- [ ] **Step 1 (lista):** `DataTable` + `StatusBadge` (tipo `nfe`: TRÂNSITO/RECEBIDA/ARMAZENADA/EXTRAVIADO).
- [ ] **Step 2 (detalhe):** `Timeline` (pattern) com o histórico `EventoRastreio` + formulário de avanço de status (`Select`/`Textarea`/`Button`). Preservar `avancarRastreio` e a auditoria em cada mudança.
- [ ] **Step 3: Verificação** — navegar; screenshots; timeline correta; EXTRAVIADO em vermelho; console limpo.
- [ ] **Step 4:** `npx tsc --noEmit` + `npm test` + `npm run e2e -- rastreio` → PASS.
- [ ] **Step 5: Commit** — `git commit -am "feat(ds): migra Rastreio de NFe para Untitled UI"`

---

### Task 12: Limpeza — remover shadcn/Base UI e órfãos

**Files:** Delete `src/components/ui/{badge,button,card,input,label,table,tabs}.tsx` antigos (os do shadcn), `components.json`; Modify `package.json`, `globals.css` (já feito), `src/lib/utils.ts`.

- [ ] **Step 1:** Confirmar que nenhum arquivo ainda importa os componentes shadcn antigos nem `@base-ui/react`:
```bash
grep -rn "@base-ui/react" src ; grep -rn "shadcn" src ; grep -rn "buttonVariants" src
```
Migrar quaisquer remanescentes.
- [ ] **Step 2:** Remover os `.tsx` shadcn antigos de `src/components/ui/` que foram substituídos (garantir que os novos Untitled UI têm os mesmos caminhos ou que os imports foram atualizados).
- [ ] **Step 3:** Desinstalar deps órfãs:
```bash
npm rm @base-ui/react shadcn tw-animate-css
# remover lucide-react apenas se não houver mais nenhum import
grep -rn "lucide-react" src || npm rm lucide-react
```
- [ ] **Step 4:** Simplificar `src/lib/utils.ts` (manter só o necessário) e remover `components.json` do shadcn.
- [ ] **Step 5:** `npx tsc --noEmit` + `npm test` + `npm run build` → PASS. (Build precisa passar sem os pacotes removidos.)
- [ ] **Step 6: Commit** — `git commit -am "chore(ds): remove shadcn/Base UI e dependências órfãs"`

---

### Task 13: Rota `/design-system` (catálogo) + `DESIGN_SYSTEM.md`

**Files:** Create `src/app/(app)/design-system/page.tsx`; Create `DESIGN_SYSTEM.md` (raiz).

- [ ] **Step 1:** Criar a página de catálogo mostrando **tokens reais** (amostras de cor grafite/vermelho/neutros/semânticos, tipografia Inter com a escala `text-*`/`display-*`, radius, sombras) e **componentes reais** (Button em todas as variantes/estados, Input/Select/Checkbox, Badge/StatusBadge de todos os estados do domínio, Table, Tabs, Modal, Timeline, EmptyState, PageHeader). Renderiza dentro do `AppShell`.
- [ ] **Step 2:** Escrever `DESIGN_SYSTEM.md`: origem (Untitled UI OSS/MIT), identidade (grafite+vermelho da logo, só claro), tokens e onde ficam (`src/styles/theme.css`), estrutura de pastas (`ui/application/patterns/layouts`), como adicionar/atualizar componentes (`npx untitledui add`), convenções (imports `@/lib/cx`, ícones `@untitledui/icons`), e o link para ADR-011.
- [ ] **Step 3: Verificação** — `navigate /design-system`; screenshot; conferir que todas as amostras renderizam.
- [ ] **Step 4:** `npx tsc --noEmit` → PASS.
- [ ] **Step 5: Commit** — `git commit -am "docs(ds): rota /design-system (catálogo) + DESIGN_SYSTEM.md"`

---

### Task 14: Validação final (responsividade + suíte completa)

- [ ] **Step 1: Responsivo** — para cada tela principal (login, dashboard, pedidos lista/detalhe, conferência detalhe, cadastros form, rastreio detalhe, /design-system): `resize_window` desktop (1280), tablet (768), mobile (375); screenshot; conferir sidebar colapsa no mobile, tabelas rolam horizontalmente, sem overflow do body. Corrigir o que quebrar.
- [ ] **Step 2: Verificar ausência do visual antigo** — `grep -rn "buttonVariants\|@base-ui/react\|shadcn\|tw-animate" src` → vazio. Nenhuma tela com aparência cinza/shadcn.
- [ ] **Step 3: Suíte completa**
```bash
npx tsc --noEmit && npm run lint && npm test && npm run e2e && npm run build
```
Todos verdes. Corrigir seletores e2e restantes por *role*/texto acessível.
- [ ] **Step 4: Atualizar docs** — marcar no CLAUDE.md (§1) a adoção do Untitled UI e conferir ADR-011/spec coerentes com o resultado.
- [ ] **Step 5: Commit final** — `git commit -am "test(ds): validação responsiva e suíte completa verdes; docs atualizados"`

---

## Self-Review (cobertura do spec)

- Tokens/tipografia/cores/espaçamento/radius/sombras → Task 1. ✓
- Componentes/variantes/estados/formulários/tabelas/navegação → Tasks 2–3. ✓
- Patterns recorrentes → Task 4. ✓
- Layouts/composição de páginas/shell → Task 5. ✓
- Migração de todas as telas → Tasks 6–11 (login, dashboard, pedidos×4, conferência×2, cadastros×7, rastreio×2 = 18). ✓
- Remoção de antigos (shadcn/Base UI) → Task 12. ✓
- Rota `/design-system` + `DESIGN_SYSTEM.md` → Task 13. ✓
- Responsividade + tsc/lint/testes/build → Task 14. ✓
- Acessibilidade → herdada do React Aria + verificação por *role* nos e2e. ✓
- Preservação de regras/rotas/APIs/permissões/estados/auditoria → Global Constraints + "preservar" em cada task. ✓
- Só tema claro; grafite+vermelho da logo → Global Constraints + Task 1. ✓
- Só componentes OSS/MIT, sem mistura de libs → Global Constraints + Task 12. ✓

Sem placeholders "TBD/TODO"; nomes consistentes (`cx`/`sortCx`, `statusBadgeConfig`, `AppShell`, `StatusBadge`). Valores exatos de cor/tokens copiados verbatim das constraints.
