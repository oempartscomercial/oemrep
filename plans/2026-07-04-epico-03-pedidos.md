# Épico 3 — Pedidos — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tornar o Pedido uma entidade real do sistema — criar pedido (manual com `S/N`
ou importado de planilha Excel), com itens e status, ciclo de vida automático
(`SEM_NFE → PARCIAL → COMPLETO → ARQUIVADO`), lista com filtros e tela de detalhe. Como
efeito colateral necessário, este plano também estabelece o **shadcn/ui** como base
visual do app (hoje só HTML+Tailwind cru), porque toda tela nova deste épico já deve
nascer com essa base em vez de precisar de retrabalho depois.

**Architecture:** Lógica de negócio pura em `src/domain/pedido/` e
`src/domain/importacao/` (sem Prisma/Next), consumida por Server Actions finas em
`src/app/(app)/pedidos/**/actions.ts`, que chamam Prisma direto e gravam auditoria via
`registrarAlteracoes`. Telas em `src/app/(app)/pedidos/**/page.tsx` seguem exatamente o
padrão já usado em `cadastros/fabricas` e `cadastros/clientes` (Épico 2): lista RSC +
form client component + server action retornando `{ erros: string[] }`.

**Tech Stack:** Next.js (App Router) + TypeScript + Prisma + PostgreSQL (Supabase) +
Vitest + Playwright + **shadcn/ui** (novo nesta plano) + **ExcelJS** (novo, parsing de
planilha).

## Global Constraints

- TDD sempre: escrever o teste, ver falhar (RED), implementar o mínimo (GREEN),
  refatorar. Nenhum código de produção sem teste que falhou antes.
- Domínio (`src/domain/**`) nunca importa `@prisma/client`, `next/*` ou `@supabase/*`.
- Toda alteração em `Pedido`/`ItemPedido` grava `EventoAuditoria` via
  `compararCampos` + `registrarAlteracoes` (padrão já usado em `criarFabrica`).
- Nomes em português no domínio (`Pedido`, `ItemPedido`, `estado`, `situacao`).
- Commit pequeno e frequente — um por tarefa concluída (não por step).
- Rodar `npm test` (Vitest) ao final de cada tarefa com teste unit/integração; rodar
  `npm run e2e` (Playwright) só nas tarefas que tocam `e2e/smoke.spec.ts`.
- `SKIP_AUTH="true"` já está no `.env` local — use-o para navegar/verificar telas
  autenticadas no navegador sem precisar de login real do Supabase.

---

## Task 0: Corrigir conexão de migração (pgbouncer trava `prisma migrate`)

**Contexto:** `DATABASE_URL` aponta para o *pooler* do Supabase em modo transação
(porta 6543, `pgbouncer=true`). Comandos de migração do Prisma (`migrate dev`,
`migrate status`) tentam obter um *advisory lock*, que **trava indefinidamente** nessa
porta. O `.env` já tem uma `DIRECT_URL` (porta 5432) que não está sendo usada. Esta
tarefa é um pré-requisito de infraestrutura para a Task 6 (migração do schema de
Pedido) — sem ela, `prisma migrate dev` do Épico 3 travaria sem erro nenhum.

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `.env.example`

**Interfaces:**
- Produces: `datasource db` com `directUrl`, usado implicitamente por todo comando
  `prisma migrate *` das tarefas seguintes.

- [ ] **Step 1: Adicionar `directUrl` ao datasource**

Em `prisma/schema.prisma`, troque o bloco `datasource db`:

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

- [ ] **Step 2: Verificar que `migrate status` não trava mais**

Run: `npx prisma migrate status`
Expected (responde em poucos segundos, não trava):
```
3 migrations found in prisma/migrations
Database schema is up to date!
```

- [ ] **Step 3: Documentar a variável no `.env.example`**

Em `.env.example`, adicione a linha (mantendo as existentes):

```
DATABASE_URL="postgresql://USER:PASS@HOST:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://USER:PASS@HOST:5432/postgres"
NEXT_PUBLIC_SUPABASE_URL="https://YOUR-PROJECT.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
```

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma .env.example
git commit -m "fix: usar conexão direta (DIRECT_URL) para migrações do Prisma"
```

---

## Task 1: Base visual — instalar shadcn/ui e restilizar telas existentes

**Contexto:** O design aprovado (`docs/design/2026-06-22-mvp-design.md`) já define
"Tailwind + shadcn/ui", mas os Épicos 1/2 só usaram Tailwind cru — por isso o app está
"incipiente" visualmente. Esta tarefa estabelece a base de componentes ANTES das telas
novas de Pedidos, para elas já nascerem com boa cara, e aplica a mesma base nas duas
telas que já existem (Login e Dashboard) para o ganho ser visível imediatamente.

Os comandos abaixo foram validados numa cópia descartável do projeto antes de entrar
neste plano — rodam sem prompts interativos.

**Files:**
- Create (via CLI): `components.json`, `src/lib/utils.ts`, `src/components/ui/button.tsx`,
  `src/components/ui/input.tsx`, `src/components/ui/table.tsx`, `src/components/ui/card.tsx`,
  `src/components/ui/badge.tsx`, `src/components/ui/label.tsx`, `src/components/ui/tabs.tsx`
- Modify (via CLI): `src/app/globals.css`, `package.json`, `package-lock.json`
- Modify: `src/components/NavLateral.tsx`, `src/app/(app)/layout.tsx`,
  `src/app/(app)/page.tsx`, `src/app/login/page.tsx`

**Interfaces:**
- Produces: `cn(...inputs: ClassValue[]): string` de `@/lib/utils`; componentes
  `Button`/`buttonVariants` de `@/components/ui/button`; `Input` de
  `@/components/ui/input`; `Label` de `@/components/ui/label`; `Card`, `CardHeader`,
  `CardTitle`, `CardDescription`, `CardContent`, `CardFooter` de
  `@/components/ui/card`; `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`,
  `TableCell` de `@/components/ui/table`; `Tabs`, `TabsList`, `TabsTrigger`,
  `TabsContent` de `@/components/ui/tabs`. Tarefas seguintes (8, 9, 10, 11) consomem
  esses componentes nas telas de Pedidos.

- [ ] **Step 1: Inicializar o shadcn/ui**

Run: `npx shadcn@latest init -d`
Expected: termina com `Project initialization completed.` e cria
`components.json`, `src/lib/utils.ts`, `src/components/ui/button.tsx`, e atualiza
`src/app/globals.css`.

- [ ] **Step 2: Adicionar os componentes base usados neste épico**

Run: `npx shadcn@latest add input table card badge label tabs -y`
Expected: `✔ Created 6 files` listando `input.tsx`, `table.tsx`, `card.tsx`,
`badge.tsx`, `label.tsx`, `tabs.tsx` em `src/components/ui/`. Este épico usa `<select>`
nativo estilizado (não o componente `Select` do shadcn) para os dropdowns de
fábrica/cliente — mais simples de conectar ao fluxo de Server Actions com FormData.

- [ ] **Step 3: Verificar que o projeto ainda compila**

Run: `npx tsc --noEmit`
Expected: nenhum erro (saída vazia).

- [ ] **Step 4: Restilizar a navegação lateral**

Substitua todo o conteúdo de `src/components/NavLateral.tsx`:

```tsx
import Link from "next/link";
import { ITENS_MENU } from "./nav-itens";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function NavLateral() {
  return (
    <nav className="flex h-screen w-56 flex-col gap-1 border-r bg-background p-4">
      <p className="mb-2 px-3 text-sm font-semibold text-muted-foreground">
        OEM Representações
      </p>
      {ITENS_MENU.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(buttonVariants({ variant: "ghost" }), "h-9 justify-start")}
        >
          {item.rotulo}
        </Link>
      ))}
    </nav>
  );
}
```

- [ ] **Step 5: Restilizar o layout autenticado**

Substitua todo o conteúdo de `src/app/(app)/layout.tsx`:

```tsx
import { NavLateral } from "@/components/NavLateral";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-muted/30">
      <NavLateral />
      <div className="flex-1 p-8">{children}</div>
    </div>
  );
}
```

- [ ] **Step 6: Restilizar o Dashboard**

Substitua todo o conteúdo de `src/app/(app)/page.tsx`:

```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DashboardPage() {
  return (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle>Dashboard</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Em construção — chega nos próximos épicos.
        </p>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 7: Restilizar a tela de login**

Substitua todo o conteúdo de `src/app/login/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { criarClienteNavegador } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    const supabase = criarClienteNavegador();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    });
    if (error) {
      setErro(error.message);
      return;
    }
    router.push("/");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">Entrar</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="senha">Senha</Label>
              <Input
                id="senha"
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                required
              />
            </div>
            {erro && <p className="text-sm text-destructive">{erro}</p>}
            <Button type="submit" className="w-full">
              Entrar
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
```

- [ ] **Step 8: Verificar visualmente no navegador**

Com o servidor de dev rodando e `SKIP_AUTH="true"` no `.env`, abra `/` e `/login` no
preview. Expected: Dashboard mostra um card "Dashboard"; `/login` (com `SKIP_AUTH`
desativado temporariamente, ou inspecionando o HTML) mostra um card centralizado com
campos de e-mail/senha estilizados, não mais a caixa crua de antes.

- [ ] **Step 9: Rodar os testes existentes**

Run: `npm test`
Expected: todos os 13 arquivos de teste continuam passando (esta tarefa não altera
lógica de domínio, só apresentação).

- [ ] **Step 10: Commit**

```bash
git add components.json src/lib/utils.ts src/components/ui src/app/globals.css \
  package.json package-lock.json src/components/NavLateral.tsx \
  "src/app/(app)/layout.tsx" "src/app/(app)/page.tsx" src/app/login/page.tsx
git commit -m "feat: estabelecer shadcn/ui como base visual e restilizar login/dashboard"
```

---

## Task 2: `recalcularEstado(itens)` — regra de COMPLETO (ADR-005)

**Files:**
- Modify: `src/domain/pedido/estado.ts`
- Modify: `src/domain/pedido/__tests__/estado.test.ts`

**Interfaces:**
- Consumes: nada (função pura nova).
- Produces: `StatusItemPedido` (type), `recalcularEstado(estadoAtual: EstadoPedido,
  itens: { status: StatusItemPedido }[]): EstadoPedido`. O type `StatusItemPedido` é
  importado pela Task 3 (`item.ts`); a função `recalcularEstado` é chamada pela Task 11
  (tela de detalhe, ao mudar status de item).

- [ ] **Step 1: Escrever os testes que falham**

Em `src/domain/pedido/__tests__/estado.test.ts`, adicione ao final do arquivo (mantendo
os testes existentes de `transicaoValida`):

```ts
import { recalcularEstado } from "../estado";

describe("recalcularEstado (ADR-005)", () => {
  it("mantém SEM_NFE mesmo com itens resolvidos (ainda não há NFe)", () => {
    expect(recalcularEstado("SEM_NFE", [{ status: "DESISTENCIA" }])).toBe("SEM_NFE");
  });

  it("mantém ARQUIVADO independente dos itens", () => {
    expect(recalcularEstado("ARQUIVADO", [{ status: "PENDENTE" }])).toBe("ARQUIVADO");
  });

  it("permanece PARCIAL quando ao menos um item está PENDENTE", () => {
    expect(
      recalcularEstado("PARCIAL", [{ status: "OK" }, { status: "PENDENTE" }]),
    ).toBe("PARCIAL");
  });

  it("vira COMPLETO quando todos os itens estão OK", () => {
    expect(
      recalcularEstado("PARCIAL", [{ status: "OK" }, { status: "OK" }]),
    ).toBe("COMPLETO");
  });

  it("vira COMPLETO quando os itens restantes são FORA_DE_FABRICACAO/DESISTENCIA", () => {
    expect(
      recalcularEstado("PARCIAL", [
        { status: "OK" },
        { status: "FORA_DE_FABRICACAO" },
        { status: "DESISTENCIA" },
      ]),
    ).toBe("COMPLETO");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/domain/pedido/__tests__/estado.test.ts`
Expected: FAIL — `recalcularEstado is not a function` (ou erro de import).

- [ ] **Step 3: Implementar**

Substitua todo o conteúdo de `src/domain/pedido/estado.ts`:

```ts
export type EstadoPedido = "SEM_NFE" | "PARCIAL" | "COMPLETO" | "ARQUIVADO";
export type StatusItemPedido = "PENDENTE" | "OK" | "FORA_DE_FABRICACAO" | "DESISTENCIA";

const TRANSICOES: Record<EstadoPedido, EstadoPedido[]> = {
  SEM_NFE: ["PARCIAL"],
  PARCIAL: ["COMPLETO"],
  COMPLETO: ["ARQUIVADO"],
  ARQUIVADO: ["COMPLETO"], // reabertura para consulta (RN17)
};

export function transicaoValida(de: EstadoPedido, para: EstadoPedido): boolean {
  return TRANSICOES[de]?.includes(para) ?? false;
}

const STATUS_QUE_RESOLVEM: StatusItemPedido[] = ["OK", "FORA_DE_FABRICACAO", "DESISTENCIA"];

// ADR-005: itens em FORA_DE_FABRICACAO/DESISTENCIA contam como resolvidos para fins
// de ciclo de vida. Só recalcula PARCIAL<->COMPLETO; SEM_NFE só sai quando a 1ª NFe é
// vinculada (Épico 4) e ARQUIVADO só muda por ação manual de reabertura.
export function recalcularEstado(
  estadoAtual: EstadoPedido,
  itens: { status: StatusItemPedido }[],
): EstadoPedido {
  if (estadoAtual === "SEM_NFE" || estadoAtual === "ARQUIVADO") return estadoAtual;
  const todosResolvidos = itens.every((item) => STATUS_QUE_RESOLVEM.includes(item.status));
  return todosResolvidos ? "COMPLETO" : "PARCIAL";
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/domain/pedido/__tests__/estado.test.ts`
Expected: PASS — 10 testes (5 antigos + 5 novos).

- [ ] **Step 5: Commit**

```bash
git add src/domain/pedido/estado.ts src/domain/pedido/__tests__/estado.test.ts
git commit -m "feat: recalcularEstado do pedido considerando itens resolvidos (ADR-005)"
```

---

## Task 3: `qtdPendente` e snapshot `qtdPendenteCongelada` (ADR-008)

**Files:**
- Create: `src/domain/pedido/item.ts`
- Create: `src/domain/pedido/__tests__/item.test.ts`

**Interfaces:**
- Consumes: `StatusItemPedido` de `src/domain/pedido/estado.ts` (Task 2).
- Produces: `calcularQtdPendente(item: { quantidadePedida: number; quantidadeFaturada:
  number }): number`; `deveCongelarPendencia(statusAnterior: StatusItemPedido,
  statusNovo: StatusItemPedido): boolean`. Consumidos pela Task 11 (ação de atualizar
  status do item).

- [ ] **Step 1: Escrever o teste que falha**

Crie `src/domain/pedido/__tests__/item.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { calcularQtdPendente, deveCongelarPendencia } from "../item";

describe("calcularQtdPendente", () => {
  it("calcula a diferença entre pedida e faturada", () => {
    expect(calcularQtdPendente({ quantidadePedida: 10, quantidadeFaturada: 4 })).toBe(6);
  });

  it("retorna 0 quando totalmente faturado", () => {
    expect(calcularQtdPendente({ quantidadePedida: 10, quantidadeFaturada: 10 })).toBe(0);
  });
});

describe("deveCongelarPendencia (ADR-008)", () => {
  it("congela ao passar de PENDENTE para FORA_DE_FABRICACAO", () => {
    expect(deveCongelarPendencia("PENDENTE", "FORA_DE_FABRICACAO")).toBe(true);
  });

  it("congela ao passar de PENDENTE para DESISTENCIA", () => {
    expect(deveCongelarPendencia("PENDENTE", "DESISTENCIA")).toBe(true);
  });

  it("não congela ao passar para OK", () => {
    expect(deveCongelarPendencia("PENDENTE", "OK")).toBe(false);
  });

  it("não re-congela se já estava resolvido por não-faturamento", () => {
    expect(deveCongelarPendencia("DESISTENCIA", "FORA_DE_FABRICACAO")).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/domain/pedido/__tests__/item.test.ts`
Expected: FAIL — `Failed to resolve import "../item"`.

- [ ] **Step 3: Implementar**

Crie `src/domain/pedido/item.ts`:

```ts
import type { StatusItemPedido } from "./estado";

export type ItemPedidoCalculo = {
  quantidadePedida: number;
  quantidadeFaturada: number;
};

export function calcularQtdPendente(item: ItemPedidoCalculo): number {
  return item.quantidadePedida - item.quantidadeFaturada;
}

const STATUS_QUE_CONGELAM: StatusItemPedido[] = ["FORA_DE_FABRICACAO", "DESISTENCIA"];

// ADR-008: ao resolver um item por não-faturamento, grava-se o saldo pendente daquele
// instante. Só congela na transição de ENTRADA nesses status, não a cada troca entre
// eles.
export function deveCongelarPendencia(
  statusAnterior: StatusItemPedido,
  statusNovo: StatusItemPedido,
): boolean {
  return STATUS_QUE_CONGELAM.includes(statusNovo) && !STATUS_QUE_CONGELAM.includes(statusAnterior);
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/domain/pedido/__tests__/item.test.ts`
Expected: PASS — 6 testes.

- [ ] **Step 5: Commit**

```bash
git add src/domain/pedido/item.ts src/domain/pedido/__tests__/item.test.ts
git commit -m "feat: qtdPendente e snapshot de congelamento por não-faturamento (ADR-008)"
```

---

## Task 4: Validação de dados do pedido manual

**Files:**
- Create: `src/domain/pedido/pedido.ts`
- Create: `src/domain/pedido/__tests__/pedido.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `ItemPedidoInput`, `DadosPedido` (types); `validarDadosPedido(dados:
  DadosPedido): string[]`. Consumido pela Task 8 (server action `criarPedidoManual`) e
  pela Task 9 (server action `confirmarImportacao`).

- [ ] **Step 1: Escrever o teste que falha**

Crie `src/domain/pedido/__tests__/pedido.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { validarDadosPedido } from "../pedido";

const ITEM_VALIDO = { referencia: "REF-1", descricao: "Peça", quantidade: 5, valorUnitario: 10 };

describe("validarDadosPedido", () => {
  it("aceita pedido com número", () => {
    expect(
      validarDadosPedido({
        numero: "PED-001",
        semNumero: false,
        fabricaId: "fab-1",
        clienteId: "cli-1",
        itens: [ITEM_VALIDO],
      }),
    ).toEqual([]);
  });

  it("aceita pedido S/N sem número", () => {
    expect(
      validarDadosPedido({
        numero: "",
        semNumero: true,
        fabricaId: "fab-1",
        clienteId: "cli-1",
        itens: [ITEM_VALIDO],
      }),
    ).toEqual([]);
  });

  it("rejeita pedido sem número e sem marcar S/N", () => {
    expect(
      validarDadosPedido({
        numero: "",
        semNumero: false,
        fabricaId: "fab-1",
        clienteId: "cli-1",
        itens: [ITEM_VALIDO],
      }),
    ).toContain("Informe o número do pedido ou marque S/N.");
  });

  it("rejeita pedido sem fábrica", () => {
    expect(
      validarDadosPedido({
        numero: "PED-001",
        semNumero: false,
        fabricaId: "",
        clienteId: "cli-1",
        itens: [ITEM_VALIDO],
      }),
    ).toContain("Selecione a fábrica.");
  });

  it("rejeita pedido sem itens", () => {
    expect(
      validarDadosPedido({
        numero: "PED-001",
        semNumero: false,
        fabricaId: "fab-1",
        clienteId: "cli-1",
        itens: [],
      }),
    ).toContain("Adicione ao menos um item.");
  });

  it("rejeita item com quantidade zero ou negativa", () => {
    const erros = validarDadosPedido({
      numero: "PED-001",
      semNumero: false,
      fabricaId: "fab-1",
      clienteId: "cli-1",
      itens: [{ ...ITEM_VALIDO, quantidade: 0 }],
    });
    expect(erros).toContain("Item 1: quantidade deve ser maior que zero.");
  });

  it("rejeita item sem referência", () => {
    const erros = validarDadosPedido({
      numero: "PED-001",
      semNumero: false,
      fabricaId: "fab-1",
      clienteId: "cli-1",
      itens: [{ ...ITEM_VALIDO, referencia: "  " }],
    });
    expect(erros).toContain("Item 1: referência é obrigatória.");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/domain/pedido/__tests__/pedido.test.ts`
Expected: FAIL — `Failed to resolve import "../pedido"`.

- [ ] **Step 3: Implementar**

Crie `src/domain/pedido/pedido.ts`:

```ts
export type ItemPedidoInput = {
  referencia: string;
  descricao: string;
  quantidade: number;
  valorUnitario: number;
};

export type DadosPedido = {
  numero: string;
  semNumero: boolean;
  fabricaId: string;
  clienteId: string;
  itens: ItemPedidoInput[];
};

export function validarDadosPedido(dados: DadosPedido): string[] {
  const erros: string[] = [];

  if (!dados.semNumero && !dados.numero.trim()) {
    erros.push("Informe o número do pedido ou marque S/N.");
  }
  if (!dados.fabricaId) erros.push("Selecione a fábrica.");
  if (!dados.clienteId) erros.push("Selecione o cliente.");
  if (dados.itens.length === 0) erros.push("Adicione ao menos um item.");

  dados.itens.forEach((item, i) => {
    if (!item.referencia.trim()) erros.push(`Item ${i + 1}: referência é obrigatória.`);
    if (item.quantidade <= 0) erros.push(`Item ${i + 1}: quantidade deve ser maior que zero.`);
    if (item.valorUnitario < 0) erros.push(`Item ${i + 1}: valor unitário não pode ser negativo.`);
  });

  return erros;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/domain/pedido/__tests__/pedido.test.ts`
Expected: PASS — 7 testes.

- [ ] **Step 5: Commit**

```bash
git add src/domain/pedido/pedido.ts src/domain/pedido/__tests__/pedido.test.ts
git commit -m "feat: validação de dados do pedido manual (RF04/RF05)"
```

---

## Task 5: Parser de Excel de pedido (RF03)

**Files:**
- Create: `src/domain/importacao/excel.ts`
- Create: `src/domain/importacao/__tests__/excel.test.ts`
- Modify: `package.json`, `package-lock.json` (dependência `exceljs`)

**Interfaces:**
- Consumes: nada (usa `exceljs`, adicionado nesta tarefa).
- Produces: `ItemExtraido` (type), `extrairItensDaPlanilha(buffer: Buffer):
  Promise<ItemExtraido[]>`. Consumido pela Task 9 (server action `analisarPlanilha`).

- [ ] **Step 1: Instalar a dependência**

Run: `npm install exceljs`
Expected: adiciona `exceljs` em `dependencies` no `package.json`.

- [ ] **Step 2: Escrever o teste que falha**

Crie `src/domain/importacao/__tests__/excel.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import { extrairItensDaPlanilha } from "../excel";

async function criarPlanilhaDeTeste(linhas: (string | number)[][]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const planilha = workbook.addWorksheet("Pedido");
  planilha.addRow(["Referência", "Descrição", "Quantidade", "Valor Unitário"]);
  linhas.forEach((linha) => planilha.addRow(linha));
  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

describe("extrairItensDaPlanilha", () => {
  it("extrai itens de uma planilha válida", async () => {
    const buffer = await criarPlanilhaDeTeste([
      ["REF-001", "Amortecedor dianteiro", 10, 125.5],
      ["REF-002", "Kit de embreagem", 2, 480],
    ]);

    const itens = await extrairItensDaPlanilha(buffer);

    expect(itens).toEqual([
      { referencia: "REF-001", descricao: "Amortecedor dianteiro", quantidade: 10, valorUnitario: 125.5 },
      { referencia: "REF-002", descricao: "Kit de embreagem", quantidade: 2, valorUnitario: 480 },
    ]);
  });

  it("ignora linhas sem referência", async () => {
    const buffer = await criarPlanilhaDeTeste([
      ["REF-001", "Amortecedor dianteiro", 10, 125.5],
      ["", "", "", ""],
    ]);

    const itens = await extrairItensDaPlanilha(buffer);
    expect(itens).toHaveLength(1);
  });

  it("rejeita planilha sem as colunas esperadas", async () => {
    const workbook = new ExcelJS.Workbook();
    const planilha = workbook.addWorksheet("Pedido");
    planilha.addRow(["Coluna A", "Coluna B"]);
    const arrayBuffer = await workbook.xlsx.writeBuffer();
    const buffer = Buffer.from(arrayBuffer);

    await expect(extrairItensDaPlanilha(buffer)).rejects.toThrow(/Colunas não encontradas/);
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx vitest run src/domain/importacao/__tests__/excel.test.ts`
Expected: FAIL — `Failed to resolve import "../excel"`.

- [ ] **Step 4: Implementar**

Crie `src/domain/importacao/excel.ts`:

```ts
import ExcelJS from "exceljs";

export type ItemExtraido = {
  referencia: string;
  descricao: string;
  quantidade: number;
  valorUnitario: number;
};

const CABECALHOS: Record<keyof ItemExtraido, string[]> = {
  referencia: ["referencia", "ref"],
  descricao: ["descricao", "produto"],
  quantidade: ["quantidade", "qtd", "qtde"],
  valorUnitario: ["valor unitario", "vlr unit", "valor"],
};

function normalizar(texto: string): string {
  return texto
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function localizarColunas(linhaCabecalho: ExcelJS.Row): Record<keyof ItemExtraido, number> {
  const indices: Partial<Record<keyof ItemExtraido, number>> = {};

  linhaCabecalho.eachCell((celula, numeroColuna) => {
    const texto = normalizar(String(celula.value ?? ""));
    for (const campo of Object.keys(CABECALHOS) as (keyof ItemExtraido)[]) {
      if (CABECALHOS[campo].includes(texto)) indices[campo] = numeroColuna;
    }
  });

  const faltando = (Object.keys(CABECALHOS) as (keyof ItemExtraido)[]).filter(
    (campo) => !indices[campo],
  );
  if (faltando.length > 0) {
    throw new Error(`Colunas não encontradas na planilha: ${faltando.join(", ")}`);
  }
  return indices as Record<keyof ItemExtraido, number>;
}

export async function extrairItensDaPlanilha(buffer: Buffer): Promise<ItemExtraido[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);

  const planilha = workbook.worksheets[0];
  if (!planilha) return [];

  const colunas = localizarColunas(planilha.getRow(1));
  const itens: ItemExtraido[] = [];

  planilha.eachRow((linha, numeroLinha) => {
    if (numeroLinha === 1) return;

    const referencia = String(linha.getCell(colunas.referencia).value ?? "").trim();
    if (!referencia) return;

    itens.push({
      referencia,
      descricao: String(linha.getCell(colunas.descricao).value ?? "").trim(),
      quantidade: Number(linha.getCell(colunas.quantidade).value ?? 0),
      valorUnitario: Number(linha.getCell(colunas.valorUnitario).value ?? 0),
    });
  });

  return itens;
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run src/domain/importacao/__tests__/excel.test.ts`
Expected: PASS — 3 testes.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/domain/importacao
git commit -m "feat: parser de planilha Excel de pedido (RF03)"
```

---

## Task 6: Schema `Pedido`/`ItemPedido` + migração

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `src/lib/__tests__/pedidos-schema.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: modelos Prisma `Pedido`, `ItemPedido`, enums `EstadoPedido`,
  `OrigemPedido`, `StatusItemPedido` — consumidos por todas as Server Actions das
  Tasks 8, 9, 10, 11.

- [ ] **Step 1: Escrever o teste de persistência que falha**

Crie `src/lib/__tests__/pedidos-schema.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { prisma } from "../prisma";

describe("schema de pedidos", () => {
  it("cria pedido com itens vinculados e lê de volta", async () => {
    const fabrica = await prisma.fabrica.create({
      data: { nome: "Fábrica Teste Pedido", cnpj: "11444777000161" },
    });
    const cliente = await prisma.cliente.create({
      data: { cnpj: "11222333000181", nomeFantasia: "Cliente Teste Pedido" },
    });

    const pedido = await prisma.pedido.create({
      data: {
        numero: "PED-001",
        origem: "MANUAL",
        fabricaId: fabrica.id,
        clienteId: cliente.id,
        itens: {
          create: [
            {
              referencia: "REF-1",
              descricao: "Peça 1",
              quantidadePedida: 10,
              valorUnitario: 25.5,
            },
          ],
        },
      },
    });

    const lido = await prisma.pedido.findUnique({
      where: { id: pedido.id },
      include: { itens: true },
    });

    expect(lido?.estado).toBe("SEM_NFE");
    expect(lido?.itens).toHaveLength(1);
    expect(lido?.itens[0].status).toBe("PENDENTE");
    expect(Number(lido?.itens[0].valorUnitario)).toBe(25.5);

    await prisma.itemPedido.deleteMany({ where: { pedidoId: pedido.id } });
    await prisma.pedido.delete({ where: { id: pedido.id } });
    await prisma.cliente.delete({ where: { id: cliente.id } });
    await prisma.fabrica.delete({ where: { id: fabrica.id } });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/pedidos-schema.test.ts`
Expected: FAIL — `Unknown property 'pedido'` (o model ainda não existe no client).

- [ ] **Step 3: Adicionar os models ao schema**

Em `prisma/schema.prisma`, adicione (após o model `EventoAuditoria`):

```prisma
enum EstadoPedido {
  SEM_NFE
  PARCIAL
  COMPLETO
  ARQUIVADO
}

enum OrigemPedido {
  EXCEL
  MANUAL
}

enum StatusItemPedido {
  PENDENTE
  OK
  FORA_DE_FABRICACAO
  DESISTENCIA
}

model Pedido {
  id        String       @id @default(cuid())
  numero    String?
  semNumero Boolean      @default(false)
  origem    OrigemPedido
  estado    EstadoPedido @default(SEM_NFE)
  fabricaId String
  clienteId String
  fabrica   Fabrica      @relation(fields: [fabricaId], references: [id])
  cliente   Cliente      @relation(fields: [clienteId], references: [id])
  itens     ItemPedido[]
  criadoEm  DateTime     @default(now())
}

model ItemPedido {
  id                   String           @id @default(cuid())
  pedidoId             String
  pedido               Pedido           @relation(fields: [pedidoId], references: [id])
  referencia           String
  descricao            String
  quantidadePedida     Int
  quantidadeFaturada   Int              @default(0)
  valorUnitario        Decimal          @db.Decimal(12, 2)
  status               StatusItemPedido @default(PENDENTE)
  observacao           String?
  qtdPendenteCongelada Int?
  criadoEm             DateTime         @default(now())
}
```

E adicione a relação inversa nos models existentes `Fabrica` e `Cliente` (uma linha em
cada, junto dos outros campos de relação):

```prisma
model Fabrica {
  // ...campos existentes...
  pedidos  Pedido[]
}

model Cliente {
  // ...campos existentes...
  pedidos  Pedido[]
}
```

- [ ] **Step 4: Rodar a migração**

Run: `npx prisma migrate dev --name pedidos`
Expected: `Your database is now in sync with your schema.` e um novo diretório em
`prisma/migrations/`.

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/pedidos-schema.test.ts`
Expected: PASS — 1 teste.

- [ ] **Step 6: Rodar toda a suíte para garantir que nada quebrou**

Run: `npm test`
Expected: todos os testes passam (nenhuma alteração em código existente).

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations src/lib/__tests__/pedidos-schema.test.ts
git commit -m "feat: schema Pedido/ItemPedido com estados e migração"
```

---

## Task 7: Filtro puro de pedidos por situação (RF06)

**Files:**
- Create: `src/domain/pedido/filtro.ts`
- Create: `src/domain/pedido/__tests__/filtro.test.ts`

**Interfaces:**
- Consumes: `EstadoPedido` de `src/domain/pedido/estado.ts` (Task 2).
- Produces: `FiltroPedido` (type: `"EM_ANDAMENTO" | "CONCLUIDOS" | "ARQUIVADOS" |
  "TODOS"`), `filtrarPedidos(pedidos: { estado: EstadoPedido }[], filtro:
  FiltroPedido): { estado: EstadoPedido }[]`. Consumido pela Task 10 (lista de
  pedidos).

- [ ] **Step 1: Escrever o teste que falha**

Crie `src/domain/pedido/__tests__/filtro.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { filtrarPedidos } from "../filtro";

const PEDIDOS = [
  { id: "1", estado: "SEM_NFE" as const },
  { id: "2", estado: "PARCIAL" as const },
  { id: "3", estado: "COMPLETO" as const },
  { id: "4", estado: "ARQUIVADO" as const },
];

describe("filtrarPedidos", () => {
  it("EM_ANDAMENTO traz SEM_NFE e PARCIAL", () => {
    const resultado = filtrarPedidos(PEDIDOS, "EM_ANDAMENTO");
    expect(resultado.map((p) => p.id)).toEqual(["1", "2"]);
  });

  it("CONCLUIDOS traz apenas COMPLETO", () => {
    const resultado = filtrarPedidos(PEDIDOS, "CONCLUIDOS");
    expect(resultado.map((p) => p.id)).toEqual(["3"]);
  });

  it("ARQUIVADOS traz apenas ARQUIVADO", () => {
    const resultado = filtrarPedidos(PEDIDOS, "ARQUIVADOS");
    expect(resultado.map((p) => p.id)).toEqual(["4"]);
  });

  it("TODOS traz tudo sem filtrar", () => {
    expect(filtrarPedidos(PEDIDOS, "TODOS")).toHaveLength(4);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/domain/pedido/__tests__/filtro.test.ts`
Expected: FAIL — `Failed to resolve import "../filtro"`.

- [ ] **Step 3: Implementar**

Crie `src/domain/pedido/filtro.ts`:

```ts
import type { EstadoPedido } from "./estado";

export type FiltroPedido = "EM_ANDAMENTO" | "CONCLUIDOS" | "ARQUIVADOS" | "TODOS";

export function filtrarPedidos<T extends { estado: EstadoPedido }>(
  pedidos: T[],
  filtro: FiltroPedido,
): T[] {
  switch (filtro) {
    case "EM_ANDAMENTO":
      return pedidos.filter((p) => p.estado === "SEM_NFE" || p.estado === "PARCIAL");
    case "CONCLUIDOS":
      return pedidos.filter((p) => p.estado === "COMPLETO");
    case "ARQUIVADOS":
      return pedidos.filter((p) => p.estado === "ARQUIVADO");
    case "TODOS":
      return pedidos;
  }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/domain/pedido/__tests__/filtro.test.ts`
Expected: PASS — 4 testes.

- [ ] **Step 5: Commit**

```bash
git add src/domain/pedido/filtro.ts src/domain/pedido/__tests__/filtro.test.ts
git commit -m "feat: filtro puro de pedidos por situação (RF06)"
```

---

## Task 8: Criar pedido manual com `S/N` (RF04/RF05)

**Files:**
- Create: `src/app/(app)/pedidos/actions.ts`
- Create: `src/app/(app)/pedidos/novo/page.tsx`
- Create: `src/app/api/clientes/route.ts`
- Modify: `e2e/smoke.spec.ts`

**Interfaces:**
- Consumes: `validarDadosPedido`/`DadosPedido` (Task 4), `obterUsuarioLogado` de
  `@/lib/sessao`, `compararCampos`/`registrarAlteracoes` (já existentes), `GET
  /api/fabricas` (já existente, criado no Épico 2).
- Produces: Server Action `criarPedidoManual(formData: FormData): Promise<{ erros:
  string[] }>`; rota `GET /api/clientes?fabricaId=` retornando `{ id, nomeFantasia
  }[]`, reaproveitada pela Task 9 (tela de importação também precisa popular o
  dropdown de clientes por fábrica). Nenhuma tarefa depende de `criarPedidoManual` em
  si (a Task 9 tem sua própria action, `confirmarImportacao`).

- [ ] **Step 1: API auxiliar de clientes por fábrica**

Crie `src/app/api/clientes/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const fabricaId = request.nextUrl.searchParams.get("fabricaId");
  if (!fabricaId) return NextResponse.json([]);

  const clientes = await prisma.cliente.findMany({
    where: { fabricas: { some: { fabricaId } } },
    select: { id: true, nomeFantasia: true },
    orderBy: { nomeFantasia: "asc" },
  });
  return NextResponse.json(clientes);
}
```

- [ ] **Step 2: Server Action de criação manual**

Crie `src/app/(app)/pedidos/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { obterUsuarioLogado } from "@/lib/sessao";
import { validarDadosPedido, type ItemPedidoInput } from "@/domain/pedido/pedido";
import { compararCampos } from "@/domain/auditoria/evento";
import { registrarAlteracoes } from "@/lib/auditoria";

function lerItensDoFormulario(formData: FormData): ItemPedidoInput[] {
  const referencias = formData.getAll("referencia").map(String);
  const descricoes = formData.getAll("descricao").map(String);
  const quantidades = formData.getAll("quantidade").map(Number);
  const valores = formData.getAll("valorUnitario").map(Number);

  return referencias.map((referencia, i) => ({
    referencia,
    descricao: descricoes[i] ?? "",
    quantidade: quantidades[i] ?? 0,
    valorUnitario: valores[i] ?? 0,
  }));
}

export async function criarPedidoManual(formData: FormData): Promise<{ erros: string[] }> {
  const numero = String(formData.get("numero") ?? "");
  const semNumero = formData.get("semNumero") === "on";
  const fabricaId = String(formData.get("fabricaId") ?? "");
  const clienteId = String(formData.get("clienteId") ?? "");
  const itens = lerItensDoFormulario(formData);

  const erros = validarDadosPedido({ numero, semNumero, fabricaId, clienteId, itens });
  if (erros.length > 0) return { erros };

  const usuario = await obterUsuarioLogado();
  if (!usuario) return { erros: ["Sessão expirada. Faça login novamente."] };

  const pedido = await prisma.pedido.create({
    data: {
      numero: semNumero ? null : numero,
      semNumero,
      origem: "MANUAL",
      fabricaId,
      clienteId,
      itens: {
        create: itens.map((item) => ({
          referencia: item.referencia,
          descricao: item.descricao,
          quantidadePedida: item.quantidade,
          valorUnitario: item.valorUnitario,
        })),
      },
    },
  });

  await registrarAlteracoes(
    compararCampos(
      "Pedido",
      pedido.id,
      usuario.id,
      {},
      { numero: pedido.numero, semNumero: pedido.semNumero, fabricaId, clienteId },
    ),
  );

  revalidatePath("/pedidos");
  return { erros: [] };
}
```

- [ ] **Step 3: Tela de criação manual**

Crie `src/app/(app)/pedidos/novo/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { criarPedidoManual } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Opcao = { id: string; nome?: string; nomeFantasia?: string };

export default function NovoPedidoPage() {
  const router = useRouter();
  const [erros, setErros] = useState<string[]>([]);
  const [fabricas, setFabricas] = useState<Opcao[]>([]);
  const [clientes, setClientes] = useState<Opcao[]>([]);
  const [fabricaId, setFabricaId] = useState("");
  const [semNumero, setSemNumero] = useState(false);
  const [linhas, setLinhas] = useState([0]);

  useEffect(() => {
    fetch("/api/fabricas").then((r) => r.json()).then(setFabricas);
  }, []);

  useEffect(() => {
    if (!fabricaId) {
      setClientes([]);
      return;
    }
    fetch(`/api/clientes?fabricaId=${fabricaId}`).then((r) => r.json()).then(setClientes);
  }, [fabricaId]);

  async function handleSubmit(formData: FormData) {
    const resultado = await criarPedidoManual(formData);
    if (resultado.erros.length > 0) {
      setErros(resultado.erros);
      return;
    }
    router.push("/pedidos");
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Novo pedido</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="fabricaId">Fábrica</Label>
            <select
              id="fabricaId"
              name="fabricaId"
              className="rounded-md border px-3 py-2 text-sm"
              value={fabricaId}
              onChange={(e) => setFabricaId(e.target.value)}
              required
            >
              <option value="">Selecione...</option>
              {fabricas.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="clienteId">Cliente</Label>
            <select
              id="clienteId"
              name="clienteId"
              className="rounded-md border px-3 py-2 text-sm"
              required
              disabled={!fabricaId}
            >
              <option value="">Selecione...</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nomeFantasia}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Input
              name="numero"
              placeholder="Número do pedido"
              disabled={semNumero}
              className="max-w-xs"
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="semNumero"
                checked={semNumero}
                onChange={(e) => setSemNumero(e.target.checked)}
              />
              S/N (sem número)
            </label>
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium">Itens</legend>
            {linhas.map((linha) => (
              <div key={linha} className="flex gap-2">
                <Input name="referencia" placeholder="Referência" required />
                <Input name="descricao" placeholder="Descrição" />
                <Input name="quantidade" type="number" placeholder="Qtd" required />
                <Input name="valorUnitario" type="number" step="0.01" placeholder="Valor unit." required />
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              onClick={() => setLinhas((atual) => [...atual, atual.length])}
            >
              + Adicionar item
            </Button>
          </fieldset>

          {erros.map((erro) => (
            <p key={erro} className="text-sm text-destructive">
              {erro}
            </p>
          ))}
          <Button type="submit">Salvar</Button>
        </form>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: e2e mínimo — proteção de rota**

Em `e2e/smoke.spec.ts`, adicione (mantendo os testes existentes):

```ts
test("visitante não logado é redirecionado de /pedidos/novo", async ({ page }) => {
  await page.goto("/pedidos/novo");
  await expect(page).toHaveURL(/\/login/);
});
```

Run: `npm run e2e`
Expected: todos os testes de `e2e/smoke.spec.ts` passam (o novo incluso).

- [ ] **Step 5: Verificar manualmente o fluxo completo no navegador**

Com o servidor de dev rodando e `SKIP_AUTH="true"`, abra `/pedidos/novo`. Selecione uma
fábrica (deve popular clientes), preencha um item, marque ou não "S/N", salve.
Expected: redireciona para `/pedidos` sem erro (a lista em si só existe na Task 10 —
por ora confirme apenas que não há erro de "Sessão expirada" nem exceção no console).
Se aparecer "Sessão expirada. Faça login novamente.", é porque `obterUsuarioLogado()`
não encontra usuário mesmo com `SKIP_AUTH` — nesse caso, confirme com o usuário se há
um `Usuario` ADMIN cadastrado com `supabaseUserId` vinculado (criado via
`prisma/bootstrap-admin.ts` no Épico 2) e faça login real com aquele e-mail/senha para
este teste manual específico.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/clientes "src/app/(app)/pedidos/actions.ts" \
  "src/app/(app)/pedidos/novo" e2e/smoke.spec.ts
git commit -m "feat: criação manual de pedido com suporte a S/N (RF04/RF05)"
```

---

## Task 9: Importar pedido via Excel → revisar → confirmar (RF03)

**Files:**
- Create: `src/app/(app)/pedidos/importar/actions.ts`
- Create: `src/app/(app)/pedidos/importar/page.tsx`
- Modify: `e2e/smoke.spec.ts`

**Interfaces:**
- Consumes: `extrairItensDaPlanilha` (Task 5), `validarDadosPedido` (Task 4),
  `obterUsuarioLogado`, `compararCampos`/`registrarAlteracoes`, `GET /api/fabricas`
  (já existente) e `GET /api/clientes?fabricaId=` (Task 8) para os dropdowns.
- Produces: Server Actions `analisarPlanilha(formData: FormData): Promise<{ erro?:
  string; itens?: ItemExtraido[] }>` e `confirmarImportacao(dados: { fabricaId: string;
  clienteId: string; numero: string; semNumero: boolean; itens: ItemExtraido[] }):
  Promise<{ erros: string[] }>`. Não consumido por outras tarefas deste plano.

- [ ] **Step 1: Server Actions de análise e confirmação**

Crie `src/app/(app)/pedidos/importar/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { obterUsuarioLogado } from "@/lib/sessao";
import { extrairItensDaPlanilha, type ItemExtraido } from "@/domain/importacao/excel";
import { validarDadosPedido } from "@/domain/pedido/pedido";
import { compararCampos } from "@/domain/auditoria/evento";
import { registrarAlteracoes } from "@/lib/auditoria";

export async function analisarPlanilha(
  formData: FormData,
): Promise<{ erro?: string; itens?: ItemExtraido[] }> {
  const arquivo = formData.get("arquivo") as File | null;
  if (!arquivo || arquivo.size === 0) return { erro: "Selecione um arquivo." };

  const buffer = Buffer.from(await arquivo.arrayBuffer());
  try {
    const itens = await extrairItensDaPlanilha(buffer);
    if (itens.length === 0) return { erro: "Nenhum item encontrado na planilha." };
    return { itens };
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : "Falha ao ler a planilha." };
  }
}

type DadosConfirmacao = {
  fabricaId: string;
  clienteId: string;
  numero: string;
  semNumero: boolean;
  itens: ItemExtraido[];
};

export async function confirmarImportacao(dados: DadosConfirmacao): Promise<{ erros: string[] }> {
  const erros = validarDadosPedido({
    numero: dados.numero,
    semNumero: dados.semNumero,
    fabricaId: dados.fabricaId,
    clienteId: dados.clienteId,
    itens: dados.itens.map((item) => ({
      referencia: item.referencia,
      descricao: item.descricao,
      quantidade: item.quantidade,
      valorUnitario: item.valorUnitario,
    })),
  });
  if (erros.length > 0) return { erros };

  const usuario = await obterUsuarioLogado();
  if (!usuario) return { erros: ["Sessão expirada. Faça login novamente."] };

  const pedido = await prisma.pedido.create({
    data: {
      numero: dados.semNumero ? null : dados.numero,
      semNumero: dados.semNumero,
      origem: "EXCEL",
      fabricaId: dados.fabricaId,
      clienteId: dados.clienteId,
      itens: {
        create: dados.itens.map((item) => ({
          referencia: item.referencia,
          descricao: item.descricao,
          quantidadePedida: item.quantidade,
          valorUnitario: item.valorUnitario,
        })),
      },
    },
  });

  await registrarAlteracoes(
    compararCampos(
      "Pedido",
      pedido.id,
      usuario.id,
      {},
      { numero: pedido.numero, semNumero: pedido.semNumero, origem: "EXCEL" },
    ),
  );

  revalidatePath("/pedidos");
  return { erros: [] };
}
```

- [ ] **Step 2: Tela de importação (upload → revisão → confirmação)**

Crie `src/app/(app)/pedidos/importar/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { analisarPlanilha, confirmarImportacao } from "./actions";
import type { ItemExtraido } from "@/domain/importacao/excel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Opcao = { id: string; nome?: string; nomeFantasia?: string };

export default function ImportarPedidoPage() {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [itens, setItens] = useState<ItemExtraido[] | null>(null);
  const [fabricas, setFabricas] = useState<Opcao[]>([]);
  const [clientes, setClientes] = useState<Opcao[]>([]);
  const [fabricaId, setFabricaId] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [numero, setNumero] = useState("");
  const [semNumero, setSemNumero] = useState(false);

  useEffect(() => {
    fetch("/api/fabricas").then((r) => r.json()).then(setFabricas);
  }, []);

  useEffect(() => {
    if (!fabricaId) {
      setClientes([]);
      return;
    }
    fetch(`/api/clientes?fabricaId=${fabricaId}`).then((r) => r.json()).then(setClientes);
  }, [fabricaId]);

  async function handleAnalisar(formData: FormData) {
    setErro(null);
    const resultado = await analisarPlanilha(formData);
    if (resultado.erro) {
      setErro(resultado.erro);
      return;
    }
    setItens(resultado.itens ?? []);
  }

  async function handleConfirmar() {
    if (!itens) return;
    const resultado = await confirmarImportacao({ fabricaId, clienteId, numero, semNumero, itens });
    if (resultado.erros.length > 0) {
      setErro(resultado.erros.join(" "));
      return;
    }
    router.push("/pedidos");
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Importar pedido (Excel)</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!itens && (
          <form action={handleAnalisar} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="arquivo">Planilha (.xlsx)</Label>
              <Input id="arquivo" name="arquivo" type="file" accept=".xlsx" required />
            </div>
            {erro && <p className="text-sm text-destructive">{erro}</p>}
            <Button type="submit">Analisar planilha</Button>
          </form>
        )}

        {itens && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="fabricaId">Fábrica</Label>
              <select
                id="fabricaId"
                className="rounded-md border px-3 py-2 text-sm"
                value={fabricaId}
                onChange={(e) => setFabricaId(e.target.value)}
              >
                <option value="">Selecione...</option>
                {fabricas.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nome}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="clienteId">Cliente</Label>
              <select
                id="clienteId"
                className="rounded-md border px-3 py-2 text-sm"
                value={clienteId}
                onChange={(e) => setClienteId(e.target.value)}
                disabled={!fabricaId}
              >
                <option value="">Selecione...</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nomeFantasia}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <Input
                placeholder="Número do pedido"
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
                disabled={semNumero}
                className="max-w-xs"
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={semNumero}
                  onChange={(e) => setSemNumero(e.target.checked)}
                />
                S/N (sem número)
              </label>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Referência</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Qtd</TableHead>
                  <TableHead>Valor unit.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {itens.map((item, i) => (
                  <TableRow key={i}>
                    <TableCell>{item.referencia}</TableCell>
                    <TableCell>{item.descricao}</TableCell>
                    <TableCell>{item.quantidade}</TableCell>
                    <TableCell>{item.valorUnitario}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {erro && <p className="text-sm text-destructive">{erro}</p>}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setItens(null)}>
                Escolher outro arquivo
              </Button>
              <Button onClick={handleConfirmar}>Confirmar importação</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: e2e mínimo — proteção de rota**

Em `e2e/smoke.spec.ts`, adicione:

```ts
test("visitante não logado é redirecionado de /pedidos/importar", async ({ page }) => {
  await page.goto("/pedidos/importar");
  await expect(page).toHaveURL(/\/login/);
});
```

Run: `npm run e2e`
Expected: todos os testes passam.

- [ ] **Step 4: Verificar manualmente o fluxo no navegador**

Com `SKIP_AUTH="true"` e o servidor rodando, abra `/pedidos/importar`, envie uma
planilha `.xlsx` de teste (colunas Referência/Descrição/Quantidade/Valor Unitário),
confirme que a tabela de revisão aparece, selecione fábrica/cliente e confirme.
Expected: redireciona para `/pedidos` sem erro.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/pedidos/importar" e2e/smoke.spec.ts
git commit -m "feat: importação de pedido via Excel com revisão antes de confirmar (RF03)"
```

---

## Task 10: Lista de pedidos com filtros segmentados (RF06)

**Files:**
- Create: `src/app/(app)/pedidos/page.tsx`

**Interfaces:**
- Consumes: `filtrarPedidos`/`FiltroPedido` (Task 7).
- Produces: nada consumido por outras tarefas (é a tela final da lista).

- [ ] **Step 1: Tela de lista com abas de filtro**

Crie `src/app/(app)/pedidos/page.tsx`:

```tsx
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { filtrarPedidos, type FiltroPedido } from "@/domain/pedido/filtro";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const ABAS: { valor: FiltroPedido; rotulo: string }[] = [
  { valor: "EM_ANDAMENTO", rotulo: "Em andamento" },
  { valor: "CONCLUIDOS", rotulo: "Concluídos" },
  { valor: "ARQUIVADOS", rotulo: "Arquivados" },
  { valor: "TODOS", rotulo: "Todos" },
];

function isFiltroPedido(valor: string): valor is FiltroPedido {
  return ABAS.some((aba) => aba.valor === valor);
}

export default async function PedidosPage({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string }>;
}) {
  const { filtro: filtroBruto } = await searchParams;
  const filtro: FiltroPedido = filtroBruto && isFiltroPedido(filtroBruto) ? filtroBruto : "EM_ANDAMENTO";

  const pedidos = await prisma.pedido.findMany({
    include: { fabrica: true, cliente: true, itens: true },
    orderBy: { criadoEm: "desc" },
  });

  const filtrados = filtrarPedidos(pedidos, filtro);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Pedidos</h1>
        <div className="flex gap-2">
          <Link href="/pedidos/importar">
            <Button variant="outline">Importar Excel</Button>
          </Link>
          <Link href="/pedidos/novo">
            <Button>Novo pedido</Button>
          </Link>
        </div>
      </div>

      <div className="flex gap-2 border-b pb-2">
        {ABAS.map((aba) => (
          <Link
            key={aba.valor}
            href={`/pedidos?filtro=${aba.valor}`}
            className={
              filtro === aba.valor
                ? "rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground"
                : "rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
            }
          >
            {aba.rotulo}
          </Link>
        ))}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Número</TableHead>
            <TableHead>Fábrica</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Itens</TableHead>
            <TableHead>Situação</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtrados.map((pedido) => (
            <TableRow key={pedido.id}>
              <TableCell>
                <Link href={`/pedidos/${pedido.id}`} className="underline">
                  {pedido.semNumero ? "S/N" : pedido.numero}
                </Link>
              </TableCell>
              <TableCell>{pedido.fabrica.nome}</TableCell>
              <TableCell>{pedido.cliente.nomeFantasia}</TableCell>
              <TableCell>{pedido.itens.length}</TableCell>
              <TableCell>
                <Badge variant="outline">{pedido.estado}</Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {filtrados.length === 0 && (
        <p className="text-sm text-muted-foreground">Nenhum pedido nesta situação.</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verificar manualmente no navegador**

Com `SKIP_AUTH="true"` e o servidor rodando, abra `/pedidos`. Expected: mostra os
pedidos criados nas Tasks 8/9 na aba "Em andamento" (estado `SEM_NFE`); clicar nas
outras abas filtra corretamente; clicar no número do pedido tenta ir para
`/pedidos/[id]` (só existe de fato após a Task 11 — por ora pode dar 404, o que é
esperado nesta etapa).

- [ ] **Step 3: Rodar toda a suíte**

Run: `npm test`
Expected: todos os testes passam.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/pedidos/page.tsx"
git commit -m "feat: lista de pedidos com filtros por situação (RF06)"
```

---

## Task 11: Detalhe do pedido (abas) + status de item + arquivamento (RF08/RF10/RF11)

**Files:**
- Create: `src/app/(app)/pedidos/[id]/actions.ts`
- Create: `src/app/(app)/pedidos/[id]/page.tsx`
- Create: `src/app/(app)/pedidos/[id]/item-status-form.tsx`
- Create: `src/app/(app)/pedidos/[id]/pedido-acoes.tsx`

**Interfaces:**
- Consumes: `recalcularEstado` (Task 2), `calcularQtdPendente`/`deveCongelarPendencia`
  (Task 3), `transicaoValida` (já existente), `obterUsuarioLogado`,
  `compararCampos`/`registrarAlteracoes`.
- Produces: Server Actions `atualizarStatusItem`, `arquivarPedido`, `reabrirPedido` —
  não consumidos por outras tarefas deste plano (Épico 4 vai reaproveitar
  `recalcularEstado` diretamente do domínio, não desta action).

- [ ] **Step 1: Server Actions da tela de detalhe**

Crie `src/app/(app)/pedidos/[id]/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { obterUsuarioLogado } from "@/lib/sessao";
import { recalcularEstado, transicaoValida, type StatusItemPedido } from "@/domain/pedido/estado";
import { calcularQtdPendente, deveCongelarPendencia } from "@/domain/pedido/item";
import { compararCampos } from "@/domain/auditoria/evento";
import { registrarAlteracoes } from "@/lib/auditoria";

export async function atualizarStatusItem(
  itemId: string,
  novoStatus: StatusItemPedido,
  observacao: string,
): Promise<{ erros: string[] }> {
  const usuario = await obterUsuarioLogado();
  if (!usuario) return { erros: ["Sessão expirada. Faça login novamente."] };

  const item = await prisma.itemPedido.findUnique({
    where: { id: itemId },
    include: { pedido: { include: { itens: true } } },
  });
  if (!item) return { erros: ["Item não encontrado."] };

  const congelar = deveCongelarPendencia(item.status, novoStatus);
  const qtdPendenteCongelada = congelar
    ? calcularQtdPendente({
        quantidadePedida: item.quantidadePedida,
        quantidadeFaturada: item.quantidadeFaturada,
      })
    : item.qtdPendenteCongelada;

  await prisma.itemPedido.update({
    where: { id: itemId },
    data: { status: novoStatus, observacao, qtdPendenteCongelada },
  });

  const itensAtualizados = item.pedido.itens.map((i) =>
    i.id === itemId ? { ...i, status: novoStatus } : i,
  );
  const novoEstadoPedido = recalcularEstado(item.pedido.estado, itensAtualizados);

  if (novoEstadoPedido !== item.pedido.estado) {
    await prisma.pedido.update({
      where: { id: item.pedido.id },
      data: { estado: novoEstadoPedido },
    });
  }

  await registrarAlteracoes(
    compararCampos("ItemPedido", itemId, usuario.id, { status: item.status }, { status: novoStatus }),
  );

  revalidatePath(`/pedidos/${item.pedido.id}`);
  return { erros: [] };
}

async function mudarEstadoPedido(pedidoId: string, novoEstado: "ARQUIVADO" | "COMPLETO"): Promise<{ erros: string[] }> {
  const usuario = await obterUsuarioLogado();
  if (!usuario) return { erros: ["Sessão expirada. Faça login novamente."] };

  const pedido = await prisma.pedido.findUnique({ where: { id: pedidoId } });
  if (!pedido) return { erros: ["Pedido não encontrado."] };

  if (!transicaoValida(pedido.estado, novoEstado)) {
    return { erros: [`Não é possível mudar de ${pedido.estado} para ${novoEstado}.`] };
  }

  await prisma.pedido.update({ where: { id: pedidoId }, data: { estado: novoEstado } });

  await registrarAlteracoes(
    compararCampos("Pedido", pedidoId, usuario.id, { estado: pedido.estado }, { estado: novoEstado }),
  );

  revalidatePath(`/pedidos/${pedidoId}`);
  revalidatePath("/pedidos");
  return { erros: [] };
}

// RF10: arquivamento é reversível — arquivar só é válido a partir de COMPLETO.
export async function arquivarPedido(pedidoId: string): Promise<{ erros: string[] }> {
  return mudarEstadoPedido(pedidoId, "ARQUIVADO");
}

export async function reabrirPedido(pedidoId: string): Promise<{ erros: string[] }> {
  return mudarEstadoPedido(pedidoId, "COMPLETO");
}
```

- [ ] **Step 2: Tela de detalhe com abas Itens/Notas/Histórico**

Crie `src/app/(app)/pedidos/[id]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ItemStatusForm } from "./item-status-form";
import { PedidoAcoes } from "./pedido-acoes";

export default async function DetalhePedidoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const pedido = await prisma.pedido.findUnique({
    where: { id },
    include: { fabrica: true, cliente: true, itens: true },
  });
  if (!pedido) notFound();

  const eventos = await prisma.eventoAuditoria.findMany({
    where: { entidade: "Pedido", entidadeId: pedido.id },
    orderBy: { criadoEm: "desc" },
  });

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Pedido {pedido.semNumero ? "S/N" : pedido.numero}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {pedido.fabrica.nome} · {pedido.cliente.nomeFantasia}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{pedido.estado}</Badge>
            <PedidoAcoes pedidoId={pedido.id} estado={pedido.estado} />
          </div>
        </CardHeader>
      </Card>

      <Tabs defaultValue="itens">
        <TabsList>
          <TabsTrigger value="itens">Itens</TabsTrigger>
          <TabsTrigger value="notas">Notas fiscais</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="itens">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Referência</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Pedida</TableHead>
                <TableHead>Faturada</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pedido.itens.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.referencia}</TableCell>
                  <TableCell>{item.descricao}</TableCell>
                  <TableCell>{item.quantidadePedida}</TableCell>
                  <TableCell>{item.quantidadeFaturada}</TableCell>
                  <TableCell>
                    <ItemStatusForm itemId={item.id} statusAtual={item.status} observacaoAtual={item.observacao ?? ""} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="notas">
          <p className="text-sm text-muted-foreground">
            Nenhuma NFe vinculada ainda — chega no próximo épico.
          </p>
        </TabsContent>

        <TabsContent value="historico">
          <ul className="flex flex-col gap-2 text-sm">
            {eventos.map((evento) => (
              <li key={evento.id} className="border-b pb-2">
                <span className="font-medium">{evento.campo}</span>: {evento.valorAnterior ?? "—"} →{" "}
                {evento.valorNovo ?? "—"}{" "}
                <span className="text-muted-foreground">
                  ({new Date(evento.criadoEm).toLocaleString("pt-BR")})
                </span>
              </li>
            ))}
            {eventos.length === 0 && (
              <p className="text-muted-foreground">Nenhum evento registrado ainda.</p>
            )}
          </ul>
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

- [ ] **Step 3: Componente client de status do item**

Crie `src/app/(app)/pedidos/[id]/item-status-form.tsx`:

```tsx
"use client";

import { useState } from "react";
import { atualizarStatusItem } from "./actions";
import type { StatusItemPedido } from "@/domain/pedido/estado";

const OPCOES: StatusItemPedido[] = ["PENDENTE", "OK", "FORA_DE_FABRICACAO", "DESISTENCIA"];

export function ItemStatusForm({
  itemId,
  statusAtual,
  observacaoAtual,
}: {
  itemId: string;
  statusAtual: StatusItemPedido;
  observacaoAtual: string;
}) {
  const [status, setStatus] = useState<StatusItemPedido>(statusAtual);
  const [observacao, setObservacao] = useState(observacaoAtual);
  const [erro, setErro] = useState<string | null>(null);

  async function handleChange(novoStatus: StatusItemPedido) {
    setStatus(novoStatus);
    const resultado = await atualizarStatusItem(itemId, novoStatus, observacao);
    if (resultado.erros.length > 0) setErro(resultado.erros.join(" "));
    else setErro(null);
  }

  return (
    <div className="flex flex-col gap-1">
      <select
        className="rounded-md border px-2 py-1 text-sm"
        value={status}
        onChange={(e) => handleChange(e.target.value as StatusItemPedido)}
      >
        {OPCOES.map((opcao) => (
          <option key={opcao} value={opcao}>
            {opcao}
          </option>
        ))}
      </select>
      {(status === "FORA_DE_FABRICACAO" || status === "DESISTENCIA") && (
        <input
          className="rounded-md border px-2 py-1 text-xs"
          placeholder="Observação"
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          onBlur={() => atualizarStatusItem(itemId, status, observacao)}
        />
      )}
      {erro && <p className="text-xs text-destructive">{erro}</p>}
    </div>
  );
}
```

- [ ] **Step 4: Componente client de arquivar/reabrir**

Crie `src/app/(app)/pedidos/[id]/pedido-acoes.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { arquivarPedido, reabrirPedido } from "./actions";
import { Button } from "@/components/ui/button";
import type { EstadoPedido } from "@/domain/pedido/estado";

export function PedidoAcoes({ pedidoId, estado }: { pedidoId: string; estado: EstadoPedido }) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);

  async function handleArquivar() {
    const resultado = await arquivarPedido(pedidoId);
    if (resultado.erros.length > 0) setErro(resultado.erros.join(" "));
    else router.refresh();
  }

  async function handleReabrir() {
    const resultado = await reabrirPedido(pedidoId);
    if (resultado.erros.length > 0) setErro(resultado.erros.join(" "));
    else router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      {estado === "COMPLETO" && <Button variant="outline" onClick={handleArquivar}>Arquivar</Button>}
      {estado === "ARQUIVADO" && <Button variant="outline" onClick={handleReabrir}>Reabrir</Button>}
      {erro && <p className="text-xs text-destructive">{erro}</p>}
    </div>
  );
}
```

- [ ] **Step 5: Verificar manualmente o fluxo completo no navegador**

Com `SKIP_AUTH="true"` e o servidor rodando: abra `/pedidos`, clique num pedido para
ir ao detalhe. Expected: vê as 3 abas (Itens/Notas fiscais/Histórico); mudar o status
de todos os itens para "OK" ou "DESISTÊNCIA" faz o badge do pedido virar `COMPLETO` e o
botão "Arquivar" aparecer; clicar "Arquivar" muda para `ARQUIVADO` e mostra "Reabrir";
a aba Histórico mostra os eventos de auditoria de cada mudança.

- [ ] **Step 6: Rodar toda a suíte**

Run: `npm test`
Expected: todos os testes passam (esta tarefa não adiciona testes de unidade novos —
a lógica pura já foi testada nas Tasks 2 e 3; aqui só conectamos à UI/Server Actions,
verificado manualmente no Step 5).

- [ ] **Step 7: Commit**

```bash
git add "src/app/(app)/pedidos/[id]"
git commit -m "feat: detalhe do pedido com abas, status de item e arquivamento (RF08/RF10/RF11)"
```

---

## Definition of Done do Épico 3

- [ ] `npm test` verde (todos os testes de domínio + persistência).
- [ ] `npm run e2e` verde (proteção de rota das novas telas).
- [ ] Fluxo demonstrável no navegador: importar OU criar manualmente um pedido, ver na
  lista filtrada, abrir o detalhe, mudar status de itens até `COMPLETO`, arquivar e
  reabrir.
- [ ] Toda mudança em `Pedido`/`ItemPedido` aparece na aba Histórico (auditoria).
- [ ] App visualmente consistente (shadcn/ui) em Login, Dashboard e todas as telas
  novas de Pedidos.
