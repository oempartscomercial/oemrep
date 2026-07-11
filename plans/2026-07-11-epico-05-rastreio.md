# Épico 5 — Rastreio de NFe — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar à NFe um status logístico manual (`TRÂNSITO → RECEBIDA → ARMAZENADA`, com desvio `EXTRAVIADO`) com uma timeline de eventos e observação/data por transição (RF20).

**Architecture:** A regra de transição vive numa função pura em `src/domain/nfe/rastreio.ts` (TDD). O **status atual** continua no campo `NotaFiscal.status` (enum `StatusRastreio`, já existente desde o Épico 4) — não criamos um modelo `Rastreio` separado, para não duplicar esse dado. Adicionamos apenas `EventoRastreio` para guardar a **timeline** (status anterior/novo, observação, data do evento logístico, usuário). A server action `avancarRastreio` é fina: valida pela função de domínio, grava o evento, atualiza `NotaFiscal.status` e registra `EventoAuditoria` (auditoria de 100%). As telas (`/rastreio` e `/rastreio/[id]`) são server components que leem via Prisma e delegam a interação a um client component.

**Tech Stack:** TypeScript (strict), Next.js App Router (`src/`), Prisma + PostgreSQL (Supabase), Supabase Auth, Tailwind + shadcn/ui, Vitest (unidade/integração), Playwright (e2e).

## Global Constraints

- **TDD sempre:** RED → GREEN → REFACTOR. Nenhum código de produção sem um teste que falhou antes. As regras de negócio (transições) moram no domínio e são 100% cobertas por teste; a server action é *fina* (sem ramificação além do guarda de domínio) e é verificada pelo teste de persistência + e2e, seguindo o precedente do repositório (`conferencia/actions.ts` e `pedidos/[id]/actions.ts` não têm teste unitário próprio).
- **YAGNI:** só o que o Épico 5 exige. Rastreio é **manual**; API/navegador de transportadora é V2 e não entra aqui.
- **DRY:** o status atual do rastreio é o campo `NotaFiscal.status` — não replicar num modelo `Rastreio`.
- **Auditoria de 100%:** toda mudança de `NotaFiscal.status` grava `EventoAuditoria` via `compararCampos` + `registrarAlteracoes`.
- **Domínio puro** sob `src/domain/` não importa Next/Prisma/Supabase. Nomes em português.
- **Commits pequenos**, um por tarefa concluída.
- **ADR-008 é a fonte de verdade** dos estados: `TRÂNSITO → RECEBIDA → ARMAZENADA`, desvio `EXTRAVIADO`; "S/NFE" é situação do **pedido**, não da nota.

## Decisões de design (registrar no PR; não requer novo ADR)

1. **Sem modelo `Rastreio`.** O brief (`plans/2026-06-22-epics-02-07-briefs.md`, Épico 5) previa `Rastreio` + `EventoRastreio`. Como o Épico 4 já colocou `status StatusRastreio @default(TRANSITO)` em `NotaFiscal`, um modelo `Rastreio` 1-1 duplicaria esse campo. Mantemos o status em `NotaFiscal` e criamos só `EventoRastreio`. Isso honra ADR-008 (os estados são os mesmos) e o código já existente.
2. **Transições permitidas:** `TRANSITO → {RECEBIDA, EXTRAVIADO}`, `RECEBIDA → {ARMAZENADA}`. `ARMAZENADA` e `EXTRAVIADO` são **terminais** (sem saída). O "desvio para EXTRAVIADO" (ADR-008) parte do trânsito — uma nota já recebida não vira extraviada (isso seria uma divergência, Épico 6).
3. **`dataEvento`** é a data em que o evento logístico ocorreu (pode ser retroativa), informada pelo usuário; `criadoEm` é o timestamp do registro no sistema.

---

## File Structure

- **Create** `src/domain/nfe/rastreio.ts` — função pura: tipo `StatusRastreio`, tabela de transições, `transicaoRastreioValida`, `proximosStatusRastreio`, constante `STATUS_RASTREIO`.
- **Create** `src/domain/nfe/__tests__/rastreio.test.ts` — TDD das transições.
- **Modify** `prisma/schema.prisma` — novo modelo `EventoRastreio` + back-relations em `NotaFiscal` e `Usuario`.
- **Create** `prisma/migrations/<timestamp>_rastreio_nfe/migration.sql` — gerada por `prisma migrate dev`.
- **Create** `src/lib/__tests__/rastreio-schema.test.ts` — teste de persistência da timeline.
- **Create** `src/app/(app)/rastreio/actions.ts` — server action `avancarRastreio`.
- **Create** `src/app/(app)/rastreio/page.tsx` — lista de NFes com status atual.
- **Create** `src/app/(app)/rastreio/[id]/page.tsx` — detalhe: cabeçalho + form + timeline.
- **Create** `src/app/(app)/rastreio/[id]/rastreio-form.tsx` — client component do form de transição.
- **Modify** `e2e/smoke.spec.ts` — redirect de `/rastreio` para `/login`.

> A rota `/rastreio` já existe no menu (`src/components/nav-itens.ts`), então nenhuma mudança de navegação é necessária.

---

## Task 1: Máquina de estado do rastreio (domínio puro)

**Files:**
- Create: `src/domain/nfe/rastreio.ts`
- Test: `src/domain/nfe/__tests__/rastreio.test.ts`

**Interfaces:**
- Consumes: nada (função pura, sem dependências).
- Produces:
  - `type StatusRastreio = "TRANSITO" | "RECEBIDA" | "ARMAZENADA" | "EXTRAVIADO"`
  - `const STATUS_RASTREIO: StatusRastreio[]` (na ordem TRANSITO, RECEBIDA, ARMAZENADA, EXTRAVIADO)
  - `function transicaoRastreioValida(de: StatusRastreio, para: StatusRastreio): boolean`
  - `function proximosStatusRastreio(de: StatusRastreio): StatusRastreio[]`

- [ ] **Step 1: Write the failing test**

Create `src/domain/nfe/__tests__/rastreio.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  transicaoRastreioValida,
  proximosStatusRastreio,
  STATUS_RASTREIO,
} from "../rastreio";

describe("transição de rastreio (ADR-008)", () => {
  it("permite TRANSITO → RECEBIDA", () => {
    expect(transicaoRastreioValida("TRANSITO", "RECEBIDA")).toBe(true);
  });
  it("permite RECEBIDA → ARMAZENADA", () => {
    expect(transicaoRastreioValida("RECEBIDA", "ARMAZENADA")).toBe(true);
  });
  it("permite o desvio TRANSITO → EXTRAVIADO", () => {
    expect(transicaoRastreioValida("TRANSITO", "EXTRAVIADO")).toBe(true);
  });
  it("rejeita pular etapas: TRANSITO → ARMAZENADA", () => {
    expect(transicaoRastreioValida("TRANSITO", "ARMAZENADA")).toBe(false);
  });
  it("rejeita retroceder: RECEBIDA → TRANSITO", () => {
    expect(transicaoRastreioValida("RECEBIDA", "TRANSITO")).toBe(false);
  });
  it("rejeita desvio a partir de RECEBIDA: RECEBIDA → EXTRAVIADO", () => {
    expect(transicaoRastreioValida("RECEBIDA", "EXTRAVIADO")).toBe(false);
  });
});

describe("próximos status de rastreio", () => {
  it("lista os próximos válidos a partir de TRANSITO", () => {
    expect(proximosStatusRastreio("TRANSITO")).toEqual(["RECEBIDA", "EXTRAVIADO"]);
  });
  it("lista ARMAZENADA como único próximo de RECEBIDA", () => {
    expect(proximosStatusRastreio("RECEBIDA")).toEqual(["ARMAZENADA"]);
  });
  it("trata ARMAZENADA como estado final", () => {
    expect(proximosStatusRastreio("ARMAZENADA")).toEqual([]);
  });
  it("trata EXTRAVIADO como estado final", () => {
    expect(proximosStatusRastreio("EXTRAVIADO")).toEqual([]);
  });
});

describe("catálogo de status", () => {
  it("expõe os quatro status na ordem do fluxo", () => {
    expect(STATUS_RASTREIO).toEqual(["TRANSITO", "RECEBIDA", "ARMAZENADA", "EXTRAVIADO"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/domain/nfe/__tests__/rastreio.test.ts`
Expected: FAIL — `Failed to resolve import "../rastreio"` (arquivo ainda não existe).

- [ ] **Step 3: Write minimal implementation**

Create `src/domain/nfe/rastreio.ts`:

```ts
export type StatusRastreio = "TRANSITO" | "RECEBIDA" | "ARMAZENADA" | "EXTRAVIADO";

export const STATUS_RASTREIO: StatusRastreio[] = [
  "TRANSITO",
  "RECEBIDA",
  "ARMAZENADA",
  "EXTRAVIADO",
];

// ADR-008: fluxo logístico da NFe é TRÂNSITO → RECEBIDA → ARMAZENADA, com desvio para
// EXTRAVIADO a partir do trânsito. ARMAZENADA e EXTRAVIADO são estados terminais.
const TRANSICOES: Record<StatusRastreio, StatusRastreio[]> = {
  TRANSITO: ["RECEBIDA", "EXTRAVIADO"],
  RECEBIDA: ["ARMAZENADA"],
  ARMAZENADA: [],
  EXTRAVIADO: [],
};

export function proximosStatusRastreio(de: StatusRastreio): StatusRastreio[] {
  return TRANSICOES[de] ?? [];
}

export function transicaoRastreioValida(de: StatusRastreio, para: StatusRastreio): boolean {
  return TRANSICOES[de]?.includes(para) ?? false;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/domain/nfe/__tests__/rastreio.test.ts`
Expected: PASS (todos os casos verdes).

- [ ] **Step 5: Commit**

```bash
git add src/domain/nfe/rastreio.ts src/domain/nfe/__tests__/rastreio.test.ts
git commit -m "feat: máquina de estado do rastreio de NFe (ADR-008)"
```

---

## Task 2: Modelo EventoRastreio + migração + teste de persistência

**Files:**
- Modify: `prisma/schema.prisma` (add `EventoRastreio`; back-relations em `NotaFiscal` linha ~151-164 e `Usuario` linha ~59-68)
- Create: `prisma/migrations/<timestamp>_rastreio_nfe/migration.sql` (gerada pelo CLI)
- Test: `src/lib/__tests__/rastreio-schema.test.ts`

**Interfaces:**
- Consumes: enum `StatusRastreio` já existente no schema; modelos `NotaFiscal`, `Usuario`, `Fabrica`, `Cliente`.
- Produces: modelo Prisma `EventoRastreio` com campos `id, notaFiscalId, statusAnterior, status, observacao, dataEvento, usuarioId, criadoEm` e relações `notaFiscal` e `usuario`. Delegate Prisma: `prisma.eventoRastreio`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/rastreio-schema.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { prisma } from "../prisma";

describe("schema de EventoRastreio", () => {
  it("registra transições de rastreio de uma NFe e lê a timeline em ordem", async () => {
    const fabrica = await prisma.fabrica.create({
      data: { nome: "Fábrica Rastreio", cnpj: "44555666000188" },
    });
    const cliente = await prisma.cliente.create({
      data: { cnpj: "66555444000199", nomeFantasia: "Cliente Rastreio" },
    });
    const usuario = await prisma.usuario.create({
      data: { nome: "Op Rastreio", email: "rastreio-schema@teste.dev" },
    });
    const notaFiscal = await prisma.notaFiscal.create({
      data: {
        numero: "5678",
        chaveAcesso: "35260744555666000188550010000056781123456789",
        emitenteCnpj: fabrica.cnpj,
        destinatarioCnpj: cliente.cnpj,
        dataEmissao: new Date("2026-07-01T10:00:00-03:00"),
        totalProdutos: 100,
        totalNota: 110,
      },
    });

    await prisma.eventoRastreio.create({
      data: {
        notaFiscalId: notaFiscal.id,
        statusAnterior: "TRANSITO",
        status: "RECEBIDA",
        observacao: "Recebida na doca 3",
        dataEvento: new Date("2026-07-03T00:00:00-03:00"),
        usuarioId: usuario.id,
      },
    });
    await prisma.eventoRastreio.create({
      data: {
        notaFiscalId: notaFiscal.id,
        statusAnterior: "RECEBIDA",
        status: "ARMAZENADA",
        dataEvento: new Date("2026-07-04T00:00:00-03:00"),
        usuarioId: usuario.id,
      },
    });

    const timeline = await prisma.eventoRastreio.findMany({
      where: { notaFiscalId: notaFiscal.id },
      orderBy: { dataEvento: "asc" },
      include: { usuario: true },
    });

    expect(timeline).toHaveLength(2);
    expect(timeline[0].status).toBe("RECEBIDA");
    expect(timeline[0].statusAnterior).toBe("TRANSITO");
    expect(timeline[0].observacao).toBe("Recebida na doca 3");
    expect(timeline[0].usuario.nome).toBe("Op Rastreio");
    expect(timeline[1].status).toBe("ARMAZENADA");
    expect(timeline[1].observacao).toBeNull();

    await prisma.eventoRastreio.deleteMany({ where: { notaFiscalId: notaFiscal.id } });
    await prisma.notaFiscal.delete({ where: { id: notaFiscal.id } });
    await prisma.usuario.delete({ where: { id: usuario.id } });
    await prisma.cliente.delete({ where: { id: cliente.id } });
    await prisma.fabrica.delete({ where: { id: fabrica.id } });
  }, 15000);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/__tests__/rastreio-schema.test.ts`
Expected: FAIL — TypeScript/Prisma erro `Property 'eventoRastreio' does not exist` (o modelo ainda não existe no client).

- [ ] **Step 3: Add the model to the schema**

Em `prisma/schema.prisma`, adicione a back-relation em `NotaFiscal` (dentro do modelo existente, após a linha `itensFaturados   ItemFaturado[]`):

```prisma
  eventosRastreio  EventoRastreio[]
```

Adicione a back-relation em `Usuario` (após a linha `eventos        EventoAuditoria[]`):

```prisma
  eventosRastreio EventoRastreio[]
```

Adicione o novo modelo ao final do arquivo:

```prisma
model EventoRastreio {
  id             String         @id @default(cuid())
  notaFiscalId   String
  notaFiscal     NotaFiscal     @relation(fields: [notaFiscalId], references: [id])
  statusAnterior StatusRastreio
  status         StatusRastreio
  observacao     String?
  dataEvento     DateTime
  usuarioId      String
  usuario        Usuario        @relation(fields: [usuarioId], references: [id])
  criadoEm       DateTime       @default(now())

  @@index([notaFiscalId])
}
```

- [ ] **Step 4: Generate the migration and Prisma client**

Run: `npx prisma migrate dev --name rastreio_nfe`
Expected: cria `prisma/migrations/<timestamp>_rastreio_nfe/migration.sql` (com `CREATE TABLE "EventoRastreio" ...`), aplica no banco e regenera o Prisma Client. Nenhum prompt de perda de dados (é só adição de tabela).

> Se o CLI reclamar de conexão, confirme que `.env` tem `DATABASE_URL`/`DIRECT_URL` válidos (mesma config usada pelos testes de schema do Épico 4).

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- src/lib/__tests__/rastreio-schema.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations src/lib/__tests__/rastreio-schema.test.ts
git commit -m "feat: modelo EventoRastreio para a timeline de rastreio da NFe"
```

---

## Task 3: Server action avancarRastreio (com auditoria)

**Files:**
- Create: `src/app/(app)/rastreio/actions.ts`

**Interfaces:**
- Consumes:
  - `transicaoRastreioValida`, `type StatusRastreio` de `@/domain/nfe/rastreio` (Task 1)
  - `prisma.notaFiscal`, `prisma.eventoRastreio` (Task 2)
  - `obterUsuarioLogado` de `@/lib/sessao`
  - `compararCampos` de `@/domain/auditoria/evento`, `registrarAlteracoes` de `@/lib/auditoria`
- Produces:
  - `async function avancarRastreio(notaFiscalId: string, novoStatus: StatusRastreio, observacao: string, dataEvento: string): Promise<{ erros: string[] }>`

> **Nota de TDD:** esta action é *fina* — toda decisão (é uma transição válida?) é feita pela função de domínio já testada na Task 1, e a persistência foi validada na Task 2. Ela não contém ramificação de regra de negócio própria, então segue o precedente do repositório (`conferencia/actions.ts`, `pedidos/[id]/actions.ts`) de não ter teste unitário isolado; a verificação end-to-end vem na Task 4.

- [ ] **Step 1: Write the server action**

Create `src/app/(app)/rastreio/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { obterUsuarioLogado } from "@/lib/sessao";
import { transicaoRastreioValida, type StatusRastreio } from "@/domain/nfe/rastreio";
import { compararCampos } from "@/domain/auditoria/evento";
import { registrarAlteracoes } from "@/lib/auditoria";

export async function avancarRastreio(
  notaFiscalId: string,
  novoStatus: StatusRastreio,
  observacao: string,
  dataEvento: string,
): Promise<{ erros: string[] }> {
  const usuario = await obterUsuarioLogado();
  if (!usuario) return { erros: ["Sessão expirada. Faça login novamente."] };

  const nota = await prisma.notaFiscal.findUnique({ where: { id: notaFiscalId } });
  if (!nota) return { erros: ["NFe não encontrada."] };

  const statusAtual = nota.status as StatusRastreio;
  if (!transicaoRastreioValida(statusAtual, novoStatus)) {
    return { erros: [`Não é possível mudar o rastreio de ${statusAtual} para ${novoStatus}.`] };
  }

  const data = new Date(dataEvento);
  if (Number.isNaN(data.getTime())) {
    return { erros: ["Data do evento inválida."] };
  }

  await prisma.eventoRastreio.create({
    data: {
      notaFiscalId: nota.id,
      statusAnterior: statusAtual,
      status: novoStatus,
      observacao: observacao.trim() || null,
      dataEvento: data,
      usuarioId: usuario.id,
    },
  });

  await prisma.notaFiscal.update({ where: { id: nota.id }, data: { status: novoStatus } });

  await registrarAlteracoes(
    compararCampos("NotaFiscal", nota.id, usuario.id, { status: statusAtual }, { status: novoStatus }),
  );

  revalidatePath(`/rastreio/${nota.id}`);
  revalidatePath("/rastreio");
  return { erros: [] };
}
```

- [ ] **Step 2: Verify it typechecks and the suite stays green**

Run: `npm test`
Expected: PASS (nenhum teste novo aqui; confirma que nada quebrou e que os tipos batem com Task 1/2).

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/rastreio/actions.ts"
git commit -m "feat: server action de avanço de rastreio com auditoria"
```

---

## Task 4: Telas de rastreio (lista + detalhe/timeline) e e2e

**Files:**
- Create: `src/app/(app)/rastreio/page.tsx`
- Create: `src/app/(app)/rastreio/[id]/page.tsx`
- Create: `src/app/(app)/rastreio/[id]/rastreio-form.tsx`
- Modify: `e2e/smoke.spec.ts`

**Interfaces:**
- Consumes:
  - `avancarRastreio` de `../actions` (Task 3)
  - `proximosStatusRastreio`, `type StatusRastreio` de `@/domain/nfe/rastreio` (Task 1)
  - `prisma.notaFiscal`, `prisma.eventoRastreio` (Task 2)
  - Componentes de UI: `@/components/ui/{card,badge,table,button,input}`
- Produces: rotas `/rastreio` e `/rastreio/[id]`; client component `RastreioForm`.

- [ ] **Step 1: Write the failing e2e test**

Em `e2e/smoke.spec.ts`, adicione ao final do arquivo:

```ts
test("visitante não logado é redirecionado de /rastreio", async ({ page }) => {
  await page.goto("/rastreio");
  await expect(page).toHaveURL(/\/login/);
});
```

- [ ] **Step 2: Run e2e to verify it fails**

Run: `npm run e2e -- --grep "redirecionado de /rastreio"`
Expected: FAIL — a rota `/rastreio` ainda não existe (Next retorna 404, a URL não vira `/login`).

- [ ] **Step 3: Create the list page**

Create `src/app/(app)/rastreio/page.tsx`:

```tsx
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function RastreioPage() {
  const notas = await prisma.notaFiscal.findMany({ orderBy: { criadoEm: "desc" } });

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Rastreio de NFe</CardTitle>
        </CardHeader>
      </Card>

      {notas.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma NFe importada ainda.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Número</TableHead>
              <TableHead>Chave de acesso</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {notas.map((nota) => (
              <TableRow key={nota.id}>
                <TableCell>{nota.numero}</TableCell>
                <TableCell>{nota.chaveAcesso}</TableCell>
                <TableCell>
                  <Badge variant="outline">{nota.status}</Badge>
                </TableCell>
                <TableCell>
                  <Link href={`/rastreio/${nota.id}`} className="underline">
                    Ver / atualizar
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Create the client form component**

Create `src/app/(app)/rastreio/[id]/rastreio-form.tsx`:

```tsx
"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { avancarRastreio } from "../actions";
import type { StatusRastreio } from "@/domain/nfe/rastreio";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function RastreioForm({
  notaFiscalId,
  proximos,
}: {
  notaFiscalId: string;
  proximos: StatusRastreio[];
}) {
  const router = useRouter();
  const [status, setStatus] = useState<StatusRastreio>(proximos[0]);
  const [observacao, setObservacao] = useState("");
  const [dataEvento, setDataEvento] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setErro(null);
    const resultado = await avancarRastreio(notaFiscalId, status, observacao, dataEvento);
    setEnviando(false);
    if (resultado.erros.length > 0) {
      setErro(resultado.erros.join(" "));
      return;
    }
    setObservacao("");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Atualizar status</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
          <select
            className="rounded-md border px-2 py-1 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusRastreio)}
          >
            {proximos.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <Input
            type="date"
            value={dataEvento}
            onChange={(e) => setDataEvento(e.target.value)}
            required
          />
          <Input
            placeholder="Observação (opcional)"
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
          />
          <Button type="submit" disabled={enviando}>
            Registrar
          </Button>
        </form>
        {erro && <p className="mt-2 text-sm text-destructive">{erro}</p>}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 5: Create the detail page (header + form + timeline)**

Create `src/app/(app)/rastreio/[id]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { proximosStatusRastreio, type StatusRastreio } from "@/domain/nfe/rastreio";
import { RastreioForm } from "./rastreio-form";

export default async function DetalheRastreioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const nota = await prisma.notaFiscal.findUnique({ where: { id } });
  if (!nota) notFound();

  const eventos = await prisma.eventoRastreio.findMany({
    where: { notaFiscalId: nota.id },
    orderBy: { dataEvento: "desc" },
    include: { usuario: true },
  });

  const proximos = proximosStatusRastreio(nota.status as StatusRastreio);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>NFe {nota.numero}</CardTitle>
            <p className="text-sm text-muted-foreground">{nota.chaveAcesso}</p>
          </div>
          <Badge variant="outline">{nota.status}</Badge>
        </CardHeader>
      </Card>

      {proximos.length > 0 ? (
        <RastreioForm notaFiscalId={nota.id} proximos={proximos} />
      ) : (
        <p className="text-sm text-muted-foreground">
          Rastreio finalizado ({nota.status}). Não há próximas transições.
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Timeline</CardTitle>
        </CardHeader>
        <ul className="flex flex-col gap-2 px-6 pb-6 text-sm">
          {eventos.map((evento) => (
            <li key={evento.id} className="border-b pb-2">
              <span className="font-medium">
                {evento.statusAnterior} → {evento.status}
              </span>{" "}
              <span className="text-muted-foreground">
                ({new Date(evento.dataEvento).toLocaleDateString("pt-BR")} · {evento.usuario.nome})
              </span>
              {evento.observacao && <p className="text-muted-foreground">{evento.observacao}</p>}
            </li>
          ))}
          {eventos.length === 0 && (
            <p className="text-muted-foreground">Nenhum evento de rastreio ainda.</p>
          )}
        </ul>
      </Card>
    </div>
  );
}
```

- [ ] **Step 6: Run the e2e test to verify it passes**

Run: `npm run e2e -- --grep "redirecionado de /rastreio"`
Expected: PASS (rota existe e o proxy de auth redireciona o visitante para `/login`).

- [ ] **Step 7: Run the full suites**

Run: `npm test && npm run e2e`
Expected: tudo verde.

- [ ] **Step 8: Commit**

```bash
git add "src/app/(app)/rastreio" e2e/smoke.spec.ts
git commit -m "feat: telas de rastreio de NFe com timeline (RF20)"
```

---

## Definition of Done do épico

- [ ] RF20 coberto: status logístico manual da NFe avança por transições válidas (ADR-008), com observação e data por evento.
- [ ] Timeline visível por NFe em `/rastreio/[id]`; lista em `/rastreio`.
- [ ] "S/NFE" **não** é status de nota (permanece situação do pedido) — nada no rastreio o introduz.
- [ ] Toda mudança de `NotaFiscal.status` grava `EventoAuditoria`.
- [ ] `npm test` e `npm run e2e` verdes.
- [ ] Revisão em duas etapas (conformidade com spec/ADR + qualidade) ok; usar `domain-code-reviewer` e/ou `state-machine-specialist`.
- [ ] `CLAUDE.md` §1 atualizado marcando o Épico 5 como concluído e apontando o Épico 6 como próximo.
- [ ] `finishing-a-development-branch` executado.

## Self-Review (feita ao escrever o plano)

- **Cobertura da spec (brief Épico 5):** máquina de estado (Task 1) ✓; schema + migração (Task 2) ✓; atualização manual com observação+data + auditoria (Task 3) ✓; timeline e lista (Task 4) ✓. Divergência consciente: o modelo `Rastreio` do brief foi substituído pelo campo `NotaFiscal.status` já existente + `EventoRastreio` (documentado em "Decisões de design").
- **Placeholders:** nenhum — todo passo traz código/comando completo e saída esperada.
- **Consistência de tipos:** `StatusRastreio` (Task 1) é reusado nas Tasks 3 e 4; `avancarRastreio(notaFiscalId, novoStatus, observacao, dataEvento)` tem a mesma assinatura em `actions.ts` e no `RastreioForm`; `proximosStatusRastreio` retorna `StatusRastreio[]` consumido pelo form; `prisma.eventoRastreio` (Task 2) é usado nas Tasks 3 e 4.
```
