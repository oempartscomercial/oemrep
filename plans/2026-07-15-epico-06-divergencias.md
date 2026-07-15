# Épico 6 — Divergências (Chamados) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir abrir um chamado de divergência a partir de uma NFe (com motivo e itens afetados), acompanhar seu andamento numa thread de eventos com auditoria de usuário/data, e sinalizar como **crítico** — reaparecendo em destaque na fila — todo chamado sem novo evento há 30 dias (RF25–RF30, ADR-004, ADR-006).

**Architecture:** Duas funções puras em `src/domain/chamado/`: a máquina de estado (`estado.ts`, ABERTO→EM_TRATATIVA→{AGUARDANDO,RESOLVIDO}) e a regra de inatividade (`inatividade.ts`, `estaCritico`), ambas com TDD isolado de banco/Next. O schema ganha `Chamado` (nasce de uma `NotaFiscal`, ADR-004), `MotivoChamado` (tabela — não enum — para a lista ser configurável, RF26), `ChamadoItem` (vínculo N-N com `ItemPedido`, RF30) e `EventoChamado` (thread de andamento, RF28; o primeiro evento de cada chamado, com `estadoAnterior = null`, é o próprio relato de abertura). As telas (`/divergencias`, `/divergencias/nova`, `/divergencias/[id]`) são server components finos que leem via Prisma e delegam a interação a client components, seguindo exatamente o padrão já usado em `/rastreio`. O ponto de entrada (RF25) é um link "Abrir chamado" na tela de cruzamento de NFe (`/conferencia/[id]`), que já lista os itens faturados por pedido — a mesma fonte usada para popular os itens selecionáveis do chamado.

**Tech Stack:** TypeScript (strict), Next.js App Router (`src/`), Prisma + PostgreSQL (Supabase), Supabase Auth, Tailwind + shadcn/ui (Card/Table/Tabs/Badge/Button/Input/Label + elementos nativos `select`/`textarea`/`checkbox`, como já feito em `rastreio-form.tsx` e `pedidos/novo/page.tsx`), Vitest (unidade/integração contra Postgres real), Playwright (smoke de redirecionamento).

## Global Constraints

- **TDD sempre:** RED → GREEN → REFACTOR. Nenhum código de produção sem um teste que falhou antes. Regras de negócio (transições, inatividade, validação de campos) moram no domínio e são 100% cobertas por teste puro; server actions são *finas* — sem ramificação de regra própria além do guarda de domínio + autorização — e são verificadas por teste de integração contra Postgres real, seguindo o precedente do repositório (`rastreio/actions.ts`, `conferencia/actions.ts`).
- **YAGNI:** só o que o Épico 6 exige. Sem tela de CRUD de motivos (a lista é seedada; "configurável" no MVP significa "linha de banco", não "tela de admin"). Sem reabertura de chamado `RESOLVIDO` (nenhum RF pede). Sem comentário livre desacoplado de mudança de estado (todo `EventoChamado`, incluindo o de abertura, representa uma transição de estado com observação obrigatória).
- **DRY:** autorização por fábrica reaproveita `podeAcessarFabrica`/`filtroFabricasPermitidas` (`@/lib/authz`) e `obterFabricaIdDaNotaFiscal` (`@/lib/nota-fiscal-fabrica`), já existentes desde o ADR-009. Os itens selecionáveis do chamado vêm de `NotaFiscal.itensFaturados` (já usado no relatório de cruzamento, Épico 4) — nenhuma tabela nova para "item da NFe".
- **Auditoria:** o Épico 6 **não** grava `EventoAuditoria` para mudanças de `Chamado` — a seção 7 do design (`docs/design/2026-06-22-mvp-design.md`) escopa a auditoria de 100% a **pedidos e NFes**; `Chamado` é uma entidade nova cujo histórico de 100% já é o próprio `EventoChamado` (RF28). Não duplicar.
- **Domínio puro** sob `src/domain/` não importa Next/Prisma/Supabase. Nomes em português.
- **Commits pequenos**, um por tarefa concluída.
- **ADR-004 é a fonte de verdade da origem/vínculo:** chamado nasce de uma `NotaFiscal` + itens afetados; não há abertura a partir do pedido.
- **ADR-006 é a fonte de verdade dos prazos:** `prazo_chamado_critico_dias = 30`, único e global, lido da tabela `Parametro` (já seedada desde o Épico 1 em `prisma/seed.ts`), com fallback de código caso o parâmetro não exista.

## Decisões de design (registrar no PR; não requer novo ADR)

1. **`MotivoChamado` é tabela, não enum.** RF26 fala em "lista configurável"; um enum exigiria migração de schema para adicionar um motivo novo. Uma tabela com `nome` único permite estender via seed/SQL sem tocar código. Não há tela de gestão de motivos no MVP (YAGNI) — apenas o seed dos 6 motivos do PRD.
2. **Transições do chamado:** `ABERTO → EM_TRATATIVA`; `EM_TRATATIVA → {AGUARDANDO, RESOLVIDO}`; `AGUARDANDO → {EM_TRATATIVA, RESOLVIDO}` (permite voltar de "aguardando resposta" para tratativa); `RESOLVIDO` é **terminal** no MVP. O design doc descreve o fluxo como uma sequência linear, mas "aguardando" sem poder voltar para "em tratativa" tornaria o fluxo real inutilizável (ex.: aguardava resposta da fábrica, ela respondeu, o chamado volta a ser tratado).
3. **"Reaparece na fila do dia" (RF29/ADR-006) não é uma transição de estado.** É uma sinalização (`crítico: boolean`) calculada em tempo de consulta a partir do último `EventoChamado` e usada para ordenar a lista de `/divergencias` (críticos primeiro). Nenhum RF pede que o chamado *mude* de estado por inatividade.
4. **O primeiro `EventoChamado` de um chamado representa a própria abertura**, com `estadoAnterior = null` e `estado = "ABERTO"` — a `observacao` desse evento é o relato da divergência (não existe um campo `Chamado.descricao` separado; isso duplicaria a primeira entrada da thread). Eventos seguintes sempre têm `estadoAnterior` preenchido (é sempre uma transição real).
5. **`EventoChamado.observacao` é obrigatória** (diferente de `EventoRastreio.observacao`, que é opcional) — a thread de um chamado só faz sentido com texto explicando o andamento (RF28).

---

## File Structure

- **Create** `src/domain/chamado/estado.ts` (+ `__tests__/estado.test.ts`) — máquina de estado pura.
- **Create** `src/domain/chamado/inatividade.ts` (+ `__tests__/inatividade.test.ts`) — `estaCritico`.
- **Create** `src/domain/chamado/validacao.ts` (+ `__tests__/validacao.test.ts`) — validação pura dos dados de abertura.
- **Modify** `prisma/schema.prisma` — novos modelos `MotivoChamado`, `Chamado`, `ChamadoItem`, `EventoChamado`, enum `EstadoChamado`; back-relations em `NotaFiscal` (linha ~165), `ItemPedido` (linha ~141) e `Usuario` (linha ~68).
- **Create** `prisma/migrations/<timestamp>_chamado_divergencia/migration.sql` — gerada pelo CLI.
- **Modify** `prisma/seed.ts` — seed dos 6 motivos (RF26).
- **Create** `src/lib/__tests__/chamado-schema.test.ts` — teste de persistência do schema novo.
- **Create** `src/lib/parametros.ts` (+ `__tests__/parametros.test.ts`) — leitura de `Parametro` com fallback.
- **Create** `src/app/(app)/divergencias/queries.ts` — `buscarContextoAberturaChamado`, `buscarChamadosPermitidos`, `buscarChamadoComPermissao`.
- **Create** `src/app/(app)/divergencias/actions.ts` — `abrirChamado`, `registrarEventoChamado`.
- **Create** `src/app/(app)/divergencias/page.tsx` — lista (RF27, com badge de crítico RF29).
- **Create** `src/app/(app)/divergencias/nova/page.tsx` + `chamado-form.tsx` — abertura pré-alimentada pela NFe (RF25/RF30).
- **Create** `src/app/(app)/divergencias/[id]/page.tsx` + `chamado-evento-form.tsx` — detalhe com thread (RF28).
- **Create** `src/app/(app)/divergencias/__tests__/actions.test.ts` — autorização por fábrica (ADR-009) em `abrirChamado`/`registrarEventoChamado`.
- **Modify** `src/app/(app)/conferencia/[id]/page.tsx` — link "Abrir chamado" no cabeçalho.
- **Modify** `e2e/smoke.spec.ts` — redirecionamento de `/divergencias` e `/divergencias/nova` para `/login`.

> A rota `/divergencias` já existe no menu (`src/components/nav-itens.ts`), então nenhuma mudança de navegação é necessária. A proteção de rota (`src/proxy.ts` + `src/lib/auth-guard.ts`) já cobre qualquer caminho não listado como público — nenhuma mudança necessária ali.

---

## Task 1: Máquina de estado do chamado (domínio puro)

**Files:**
- Create: `src/domain/chamado/estado.ts`
- Test: `src/domain/chamado/__tests__/estado.test.ts`

**Interfaces:**
- Consumes: nada (função pura, sem dependências).
- Produces:
  - `type EstadoChamado = "ABERTO" | "EM_TRATATIVA" | "AGUARDANDO" | "RESOLVIDO"`
  - `const ESTADOS_CHAMADO: EstadoChamado[]` (ordem ABERTO, EM_TRATATIVA, AGUARDANDO, RESOLVIDO)
  - `function transicaoChamadoValida(de: EstadoChamado, para: EstadoChamado): boolean`
  - `function proximosEstadosChamado(de: EstadoChamado): EstadoChamado[]`

- [ ] **Step 1: Write the failing test**

Create `src/domain/chamado/__tests__/estado.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  transicaoChamadoValida,
  proximosEstadosChamado,
  ESTADOS_CHAMADO,
} from "../estado";

describe("transição de estado do chamado (ADR-004)", () => {
  it("permite ABERTO → EM_TRATATIVA", () => {
    expect(transicaoChamadoValida("ABERTO", "EM_TRATATIVA")).toBe(true);
  });
  it("permite EM_TRATATIVA → AGUARDANDO", () => {
    expect(transicaoChamadoValida("EM_TRATATIVA", "AGUARDANDO")).toBe(true);
  });
  it("permite EM_TRATATIVA → RESOLVIDO", () => {
    expect(transicaoChamadoValida("EM_TRATATIVA", "RESOLVIDO")).toBe(true);
  });
  it("permite voltar de AGUARDANDO → EM_TRATATIVA", () => {
    expect(transicaoChamadoValida("AGUARDANDO", "EM_TRATATIVA")).toBe(true);
  });
  it("permite AGUARDANDO → RESOLVIDO", () => {
    expect(transicaoChamadoValida("AGUARDANDO", "RESOLVIDO")).toBe(true);
  });
  it("rejeita pular etapas: ABERTO → RESOLVIDO", () => {
    expect(transicaoChamadoValida("ABERTO", "RESOLVIDO")).toBe(false);
  });
  it("rejeita pular etapas: ABERTO → AGUARDANDO", () => {
    expect(transicaoChamadoValida("ABERTO", "AGUARDANDO")).toBe(false);
  });
  it("trata RESOLVIDO como estado final", () => {
    expect(transicaoChamadoValida("RESOLVIDO", "ABERTO")).toBe(false);
    expect(transicaoChamadoValida("RESOLVIDO", "EM_TRATATIVA")).toBe(false);
  });
});

describe("próximos estados do chamado", () => {
  it("lista EM_TRATATIVA como único próximo de ABERTO", () => {
    expect(proximosEstadosChamado("ABERTO")).toEqual(["EM_TRATATIVA"]);
  });
  it("lista AGUARDANDO e RESOLVIDO como próximos de EM_TRATATIVA", () => {
    expect(proximosEstadosChamado("EM_TRATATIVA")).toEqual(["AGUARDANDO", "RESOLVIDO"]);
  });
  it("lista EM_TRATATIVA e RESOLVIDO como próximos de AGUARDANDO", () => {
    expect(proximosEstadosChamado("AGUARDANDO")).toEqual(["EM_TRATATIVA", "RESOLVIDO"]);
  });
  it("trata RESOLVIDO como estado final (sem próximos)", () => {
    expect(proximosEstadosChamado("RESOLVIDO")).toEqual([]);
  });
});

describe("catálogo de estados", () => {
  it("expõe os quatro estados na ordem do fluxo", () => {
    expect(ESTADOS_CHAMADO).toEqual(["ABERTO", "EM_TRATATIVA", "AGUARDANDO", "RESOLVIDO"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/domain/chamado/__tests__/estado.test.ts`
Expected: FAIL — `Failed to resolve import "../estado"` (arquivo ainda não existe).

- [ ] **Step 3: Write minimal implementation**

Create `src/domain/chamado/estado.ts`:

```ts
export type EstadoChamado = "ABERTO" | "EM_TRATATIVA" | "AGUARDANDO" | "RESOLVIDO";

export const ESTADOS_CHAMADO: EstadoChamado[] = [
  "ABERTO",
  "EM_TRATATIVA",
  "AGUARDANDO",
  "RESOLVIDO",
];

// ADR-004: chamado nasce ABERTO. Fluxo: ABERTO → EM_TRATATIVA → {AGUARDANDO, RESOLVIDO};
// AGUARDANDO pode voltar para EM_TRATATIVA (resposta chegou) ou avançar para RESOLVIDO.
// RESOLVIDO é terminal no MVP — reabertura não é um RF do Épico 6.
const TRANSICOES: Record<EstadoChamado, EstadoChamado[]> = {
  ABERTO: ["EM_TRATATIVA"],
  EM_TRATATIVA: ["AGUARDANDO", "RESOLVIDO"],
  AGUARDANDO: ["EM_TRATATIVA", "RESOLVIDO"],
  RESOLVIDO: [],
};

export function proximosEstadosChamado(de: EstadoChamado): EstadoChamado[] {
  return TRANSICOES[de] ?? [];
}

export function transicaoChamadoValida(de: EstadoChamado, para: EstadoChamado): boolean {
  return TRANSICOES[de]?.includes(para) ?? false;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/domain/chamado/__tests__/estado.test.ts`
Expected: PASS (todos os casos verdes).

- [ ] **Step 5: Commit**

```bash
git add src/domain/chamado/estado.ts src/domain/chamado/__tests__/estado.test.ts
git commit -m "feat: máquina de estado do chamado de divergência (ADR-004)"
```

---

## Task 2: Regra de inatividade/crítico (domínio puro)

**Files:**
- Create: `src/domain/chamado/inatividade.ts`
- Test: `src/domain/chamado/__tests__/inatividade.test.ts`

**Interfaces:**
- Consumes: nada (função pura de datas, sem dependências).
- Produces: `function estaCritico(dataUltimoEvento: Date, hoje: Date, prazoDias?: number): boolean` (padrão `prazoDias = 30`, ADR-006).

- [ ] **Step 1: Write the failing test**

Create `src/domain/chamado/__tests__/inatividade.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { estaCritico } from "../inatividade";

describe("estaCritico (ADR-006: 30 dias, padrão único global)", () => {
  it("não é crítico com 29 dias sem evento", () => {
    const dataUltimoEvento = new Date("2026-06-01T00:00:00-03:00");
    const hoje = new Date("2026-06-30T00:00:00-03:00");
    expect(estaCritico(dataUltimoEvento, hoje)).toBe(false);
  });

  it("é crítico exatamente aos 30 dias sem evento", () => {
    const dataUltimoEvento = new Date("2026-06-01T00:00:00-03:00");
    const hoje = new Date("2026-07-01T00:00:00-03:00");
    expect(estaCritico(dataUltimoEvento, hoje)).toBe(true);
  });

  it("é crítico com mais de 30 dias sem evento", () => {
    const dataUltimoEvento = new Date("2026-06-01T00:00:00-03:00");
    const hoje = new Date("2026-08-01T00:00:00-03:00");
    expect(estaCritico(dataUltimoEvento, hoje)).toBe(true);
  });

  it("não é crítico logo após um evento (0 dias)", () => {
    const agora = new Date("2026-07-01T00:00:00-03:00");
    expect(estaCritico(agora, agora)).toBe(false);
  });

  it("aceita um prazo customizado (parametrizável)", () => {
    const dataUltimoEvento = new Date("2026-06-01T00:00:00-03:00");
    const hoje = new Date("2026-06-11T00:00:00-03:00");
    expect(estaCritico(dataUltimoEvento, hoje, 10)).toBe(true);
    expect(estaCritico(dataUltimoEvento, hoje, 15)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/domain/chamado/__tests__/inatividade.test.ts`
Expected: FAIL — `Failed to resolve import "../inatividade"` (arquivo ainda não existe).

- [ ] **Step 3: Write minimal implementation**

Create `src/domain/chamado/inatividade.ts`:

```ts
const MS_POR_DIA = 1000 * 60 * 60 * 24;

// ADR-006: chamado crítico por inatividade após 30 dias sem novo evento (padrão único
// e global, configurável via Parametro "prazo_chamado_critico_dias").
export function estaCritico(dataUltimoEvento: Date, hoje: Date, prazoDias: number = 30): boolean {
  const diasSemEvento = (hoje.getTime() - dataUltimoEvento.getTime()) / MS_POR_DIA;
  return diasSemEvento >= prazoDias;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/domain/chamado/__tests__/inatividade.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/chamado/inatividade.ts src/domain/chamado/__tests__/inatividade.test.ts
git commit -m "feat: regra de inatividade/crítico do chamado (ADR-006)"
```

---

## Task 3: Schema (Chamado, MotivoChamado, ChamadoItem, EventoChamado) + migração

**Files:**
- Modify: `prisma/schema.prisma`
  - back-relation em `Usuario` (após linha 68, `eventosRastreio EventoRastreio[]`)
  - back-relation em `ItemPedido` (após linha 141, `itensFaturados ItemFaturado[]`)
  - back-relation em `NotaFiscal` (após linha 165, `eventosRastreio EventoRastreio[]`)
  - novos modelos ao final do arquivo
- Create: `prisma/migrations/<timestamp>_chamado_divergencia/migration.sql` (gerada pelo CLI)
- Test: `src/lib/__tests__/chamado-schema.test.ts`

**Interfaces:**
- Consumes: modelos `NotaFiscal`, `ItemPedido`, `Usuario` já existentes.
- Produces: modelos Prisma `MotivoChamado`, `Chamado`, `ChamadoItem`, `EventoChamado`, enum `EstadoChamado`. Delegates: `prisma.motivoChamado`, `prisma.chamado`, `prisma.chamadoItem`, `prisma.eventoChamado`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/chamado-schema.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { prisma } from "../prisma";

describe("schema de Chamado/MotivoChamado/ChamadoItem/EventoChamado", () => {
  it("abre um chamado vinculado a uma NFe e a itens do pedido, com thread de eventos", async () => {
    const fabrica = await prisma.fabrica.create({
      data: { nome: "Fábrica Chamado", cnpj: "11222333000181" },
    });
    const cliente = await prisma.cliente.create({
      data: { cnpj: "22333444000192", nomeFantasia: "Cliente Chamado" },
    });
    const usuario = await prisma.usuario.create({
      data: { nome: "Analista Chamado", email: "chamado-schema@teste.dev" },
    });
    const pedido = await prisma.pedido.create({
      data: {
        numero: "PED-CH-1",
        origem: "MANUAL",
        fabricaId: fabrica.id,
        clienteId: cliente.id,
        itens: {
          create: [
            { referencia: "REF-1", descricao: "Item 1", quantidadePedida: 10, valorUnitario: 5 },
          ],
        },
      },
      include: { itens: true },
    });
    const notaFiscal = await prisma.notaFiscal.create({
      data: {
        numero: "7777",
        chaveAcesso: "35260711222333000181550010000077771123456789",
        emitenteCnpj: fabrica.cnpj,
        destinatarioCnpj: cliente.cnpj,
        dataEmissao: new Date("2026-07-01T10:00:00-03:00"),
        totalProdutos: 50,
        totalNota: 55,
        pedidos: { create: [{ pedidoId: pedido.id }] },
        itensFaturados: {
          create: [{ itemPedidoId: pedido.itens[0].id, quantidadeFaturada: 10 }],
        },
      },
    });
    const motivo = await prisma.motivoChamado.create({ data: { nome: "Item quebrado (teste)" } });

    const chamado = await prisma.chamado.create({
      data: {
        notaFiscalId: notaFiscal.id,
        motivoId: motivo.id,
        abertoPorId: usuario.id,
        itensAfetados: { create: [{ itemPedidoId: pedido.itens[0].id }] },
        eventos: {
          create: [
            {
              estado: "ABERTO",
              estadoAnterior: null,
              observacao: "Item chegou quebrado.",
              usuarioId: usuario.id,
            },
          ],
        },
      },
    });

    const chamadoCompleto = await prisma.chamado.findUnique({
      where: { id: chamado.id },
      include: {
        itensAfetados: { include: { itemPedido: true } },
        eventos: { include: { usuario: true } },
        motivo: true,
      },
    });

    expect(chamadoCompleto?.estado).toBe("ABERTO");
    expect(chamadoCompleto?.motivo.nome).toBe("Item quebrado (teste)");
    expect(chamadoCompleto?.itensAfetados).toHaveLength(1);
    expect(chamadoCompleto?.itensAfetados[0].itemPedido.referencia).toBe("REF-1");
    expect(chamadoCompleto?.eventos).toHaveLength(1);
    expect(chamadoCompleto?.eventos[0].estadoAnterior).toBeNull();
    expect(chamadoCompleto?.eventos[0].observacao).toBe("Item chegou quebrado.");
    expect(chamadoCompleto?.eventos[0].usuario.nome).toBe("Analista Chamado");

    await prisma.eventoChamado.deleteMany({ where: { chamadoId: chamado.id } });
    await prisma.chamadoItem.deleteMany({ where: { chamadoId: chamado.id } });
    await prisma.chamado.delete({ where: { id: chamado.id } });
    await prisma.motivoChamado.delete({ where: { id: motivo.id } });
    await prisma.itemFaturado.deleteMany({ where: { notaFiscalId: notaFiscal.id } });
    await prisma.notaFiscalPedido.deleteMany({ where: { notaFiscalId: notaFiscal.id } });
    await prisma.notaFiscal.delete({ where: { id: notaFiscal.id } });
    await prisma.itemPedido.deleteMany({ where: { pedidoId: pedido.id } });
    await prisma.pedido.delete({ where: { id: pedido.id } });
    await prisma.usuario.delete({ where: { id: usuario.id } });
    await prisma.cliente.delete({ where: { id: cliente.id } });
    await prisma.fabrica.delete({ where: { id: fabrica.id } });
  }, 15000);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/__tests__/chamado-schema.test.ts`
Expected: FAIL — TypeScript/Prisma erro `Property 'motivoChamado'/'chamado' does not exist` (os modelos ainda não existem no client).

- [ ] **Step 3: Add the models to the schema**

Em `prisma/schema.prisma`, adicione a back-relation em `Usuario` (após a linha `eventosRastreio EventoRastreio[]`, linha ~68):

```prisma
  chamadosAbertos Chamado[]        @relation("ChamadoAbertoPor")
  eventosChamado  EventoChamado[]
```

Adicione a back-relation em `ItemPedido` (após `itensFaturados       ItemFaturado[]`, linha ~141):

```prisma
  chamadoItens         ChamadoItem[]
```

Adicione a back-relation em `NotaFiscal` (após `eventosRastreio  EventoRastreio[]`, linha ~165):

```prisma
  chamados         Chamado[]
```

Adicione os novos modelos ao final do arquivo:

```prisma
model MotivoChamado {
  id       String    @id @default(cuid())
  nome     String    @unique
  chamados Chamado[]
}

enum EstadoChamado {
  ABERTO
  EM_TRATATIVA
  AGUARDANDO
  RESOLVIDO
}

model Chamado {
  id            String          @id @default(cuid())
  notaFiscalId  String
  notaFiscal    NotaFiscal      @relation(fields: [notaFiscalId], references: [id])
  motivoId      String
  motivo        MotivoChamado   @relation(fields: [motivoId], references: [id])
  estado        EstadoChamado   @default(ABERTO)
  abertoPorId   String
  abertoPor     Usuario         @relation("ChamadoAbertoPor", fields: [abertoPorId], references: [id])
  itensAfetados ChamadoItem[]
  eventos       EventoChamado[]
  criadoEm      DateTime        @default(now())

  @@index([notaFiscalId])
}

model ChamadoItem {
  id           String     @id @default(cuid())
  chamadoId    String
  chamado      Chamado    @relation(fields: [chamadoId], references: [id])
  itemPedidoId String
  itemPedido   ItemPedido @relation(fields: [itemPedidoId], references: [id])

  @@unique([chamadoId, itemPedidoId])
}

model EventoChamado {
  id             String         @id @default(cuid())
  chamadoId      String
  chamado        Chamado        @relation(fields: [chamadoId], references: [id])
  estadoAnterior EstadoChamado?
  estado         EstadoChamado
  observacao     String
  usuarioId      String
  usuario        Usuario        @relation(fields: [usuarioId], references: [id])
  criadoEm       DateTime       @default(now())

  @@index([chamadoId])
}
```

- [ ] **Step 4: Generate the migration and Prisma client**

Run: `npx prisma migrate dev --name chamado_divergencia`
Expected: cria `prisma/migrations/<timestamp>_chamado_divergencia/migration.sql` (com `CREATE TABLE "MotivoChamado"`, `"Chamado"`, `"ChamadoItem"`, `"EventoChamado"` e o enum `EstadoChamado`), aplica no banco e regenera o Prisma Client. Nenhum prompt de perda de dados (é só adição de tabelas).

> Se o CLI perguntar sobre seed, responda que sim (ou rode `npx prisma db seed` manualmente depois) — o seed dos motivos entra na Task 5.

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- src/lib/__tests__/chamado-schema.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations src/lib/__tests__/chamado-schema.test.ts
git commit -m "feat: schema de Chamado/MotivoChamado/ChamadoItem/EventoChamado (ADR-004)"
```

---

## Task 4: Abrir chamado a partir da NFe (RF25/RF30)

**Files:**
- Create: `src/domain/chamado/validacao.ts`
- Test: `src/domain/chamado/__tests__/validacao.test.ts`
- Create: `src/app/(app)/divergencias/queries.ts` (parte 1: `buscarContextoAberturaChamado`)
- Create: `src/app/(app)/divergencias/actions.ts` (parte 1: `abrirChamado`)
- Create: `src/app/(app)/divergencias/nova/page.tsx`
- Create: `src/app/(app)/divergencias/nova/chamado-form.tsx`
- Modify: `src/app/(app)/conferencia/[id]/page.tsx` — link "Abrir chamado"
- Create: `src/app/(app)/divergencias/__tests__/actions.test.ts` (parte 1: autorização de `abrirChamado`)

**Interfaces:**
- Consumes:
  - `podeAcessarFabrica` de `@/lib/authz`, `obterFabricaIdDaNotaFiscal` de `@/lib/nota-fiscal-fabrica`, `obterUsuarioLogado` de `@/lib/sessao` (Épico 4/5, ADR-009)
  - `prisma.notaFiscal`, `prisma.motivoChamado`, `prisma.chamado`, `prisma.chamadoItem`, `prisma.eventoChamado` (Task 3)
- Produces:
  - `function validarAberturaChamado(dados: DadosAberturaChamado): string[]` (domínio puro)
  - `async function buscarContextoAberturaChamado(notaFiscalId: string, usuario: UsuarioSessao)` → `{ notaFiscal, motivos } | null`
  - `async function abrirChamado(formData: FormData): Promise<{ erros: string[]; chamadoId?: string }>`
  - Usado pela Task 6: `buscarChamadosPermitidos`, `buscarChamadoComPermissao` (adicionados no mesmo arquivo `queries.ts`)

### Parte A — Validação de domínio (TDD)

- [ ] **Step 1: Write the failing test**

Create `src/domain/chamado/__tests__/validacao.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { validarAberturaChamado } from "../validacao";

describe("validarAberturaChamado (RF25/RF30)", () => {
  const dadosValidos = {
    notaFiscalId: "nfe-1",
    motivoId: "motivo-1",
    observacao: "Item chegou quebrado.",
    itensAfetadosIds: ["item-1"],
  };

  it("aceita dados completos", () => {
    expect(validarAberturaChamado(dadosValidos)).toEqual([]);
  });

  it("exige a NFe de origem", () => {
    expect(validarAberturaChamado({ ...dadosValidos, notaFiscalId: "" })).toContain(
      "NFe de origem não informada.",
    );
  });

  it("exige o motivo", () => {
    expect(validarAberturaChamado({ ...dadosValidos, motivoId: "" })).toContain(
      "Selecione o motivo da divergência.",
    );
  });

  it("exige a descrição da divergência", () => {
    expect(validarAberturaChamado({ ...dadosValidos, observacao: "   " })).toContain(
      "Descreva a divergência.",
    );
  });

  it("exige ao menos um item afetado (RF30)", () => {
    expect(validarAberturaChamado({ ...dadosValidos, itensAfetadosIds: [] })).toContain(
      "Selecione ao menos um item afetado.",
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/domain/chamado/__tests__/validacao.test.ts`
Expected: FAIL — `Failed to resolve import "../validacao"`.

- [ ] **Step 3: Write minimal implementation**

Create `src/domain/chamado/validacao.ts`:

```ts
export type DadosAberturaChamado = {
  notaFiscalId: string;
  motivoId: string;
  observacao: string;
  itensAfetadosIds: string[];
};

export function validarAberturaChamado(dados: DadosAberturaChamado): string[] {
  const erros: string[] = [];

  if (!dados.notaFiscalId) erros.push("NFe de origem não informada.");
  if (!dados.motivoId) erros.push("Selecione o motivo da divergência.");
  if (!dados.observacao.trim()) erros.push("Descreva a divergência.");
  if (dados.itensAfetadosIds.length === 0) erros.push("Selecione ao menos um item afetado.");

  return erros;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/domain/chamado/__tests__/validacao.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/chamado/validacao.ts src/domain/chamado/__tests__/validacao.test.ts
git commit -m "feat: validação de abertura de chamado (RF25/RF30)"
```

### Parte B — Teste de integração de `abrirChamado` (RED)

- [ ] **Step 6: Write the failing test**

Create `src/app/(app)/divergencias/__tests__/actions.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { prisma } from "@/lib/prisma";

const obterUsuarioLogadoMock = vi.fn();
vi.mock("@/lib/sessao", () => ({
  obterUsuarioLogado: () => obterUsuarioLogadoMock(),
}));

import { abrirChamado } from "../actions";

describe("abrirChamado — autorização por fábrica (ADR-009) e regras (RF25/RF30)", () => {
  it("recusa abrir chamado quando o usuário não tem permissão na fábrica da NFe", async () => {
    const fabrica = await prisma.fabrica.create({ data: { nome: "Fábrica Chamado Action", cnpj: "90000000002175" } });
    const cliente = await prisma.cliente.create({ data: { cnpj: "90000000002256", nomeFantasia: "Cliente Chamado Action" } });
    const pedido = await prisma.pedido.create({
      data: {
        numero: "PED-CHACT-1",
        origem: "MANUAL",
        fabricaId: fabrica.id,
        clienteId: cliente.id,
        itens: { create: [{ referencia: "REF-A", descricao: "Item A", quantidadePedida: 5, valorUnitario: 10 }] },
      },
      include: { itens: true },
    });
    const nota = await prisma.notaFiscal.create({
      data: {
        numero: "9301", chaveAcesso: "35260790000000002175550010000093011123456789",
        emitenteCnpj: fabrica.cnpj, destinatarioCnpj: cliente.cnpj,
        dataEmissao: new Date("2026-07-01T10:00:00-03:00"), totalProdutos: 50, totalNota: 55,
        pedidos: { create: [{ pedidoId: pedido.id }] },
        itensFaturados: { create: [{ itemPedidoId: pedido.itens[0].id, quantidadeFaturada: 5 }] },
      },
    });
    const motivo = await prisma.motivoChamado.create({ data: { nome: "Extravio (teste ação)" } });

    try {
      obterUsuarioLogadoMock.mockResolvedValue({ id: "u1", nome: "Op", perfil: "OPERADOR", fabricasIds: ["outra"] });

      const formData = new FormData();
      formData.set("notaFiscalId", nota.id);
      formData.set("motivoId", motivo.id);
      formData.set("observacao", "Nota extraviada no transporte.");
      formData.append("itemPedidoId", pedido.itens[0].id);

      const resultado = await abrirChamado(formData);

      expect(resultado.erros).toEqual(["Você não tem permissão para abrir chamados para esta NFe."]);

      const chamados = await prisma.chamado.findMany({ where: { notaFiscalId: nota.id } });
      expect(chamados).toHaveLength(0);
    } finally {
      await prisma.motivoChamado.delete({ where: { id: motivo.id } });
      await prisma.itemFaturado.deleteMany({ where: { notaFiscalId: nota.id } });
      await prisma.notaFiscalPedido.deleteMany({ where: { notaFiscalId: nota.id } });
      await prisma.notaFiscal.delete({ where: { id: nota.id } });
      await prisma.itemPedido.deleteMany({ where: { pedidoId: pedido.id } });
      await prisma.pedido.delete({ where: { id: pedido.id } });
      await prisma.cliente.delete({ where: { id: cliente.id } });
      await prisma.fabrica.delete({ where: { id: fabrica.id } });
    }
  }, 15000);
});
```

- [ ] **Step 7: Run test to verify it fails**

Run: `npm test -- src/app/\(app\)/divergencias/__tests__/actions.test.ts`
Expected: FAIL — `Failed to resolve import "../actions"` (o arquivo ainda não existe).

### Parte C — Queries de contexto + server action `abrirChamado` (GREEN)

- [ ] **Step 8: Create the queries file**

Create `src/app/(app)/divergencias/queries.ts`:

```ts
import { prisma } from "@/lib/prisma";
import type { UsuarioSessao } from "@/lib/sessao";
import { podeAcessarFabrica } from "@/lib/authz";
import { obterFabricaIdDaNotaFiscal } from "@/lib/nota-fiscal-fabrica";

export async function buscarContextoAberturaChamado(notaFiscalId: string, usuario: UsuarioSessao) {
  const notaFiscal = await prisma.notaFiscal.findUnique({
    where: { id: notaFiscalId },
    include: { itensFaturados: { include: { itemPedido: { include: { pedido: true } } } } },
  });
  if (!notaFiscal) return null;

  const fabricaId = await obterFabricaIdDaNotaFiscal(notaFiscalId);
  if (!fabricaId || !podeAcessarFabrica(usuario, fabricaId)) return null;

  const motivos = await prisma.motivoChamado.findMany({ orderBy: { nome: "asc" } });

  return { notaFiscal, motivos };
}
```

> As demais funções deste arquivo (`buscarChamadosPermitidos`, `buscarChamadoComPermissao`) são adicionadas na Task 6, quando a lista/detalhe existirem.

- [ ] **Step 9: Create the actions file**

Create `src/app/(app)/divergencias/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { obterUsuarioLogado } from "@/lib/sessao";
import { podeAcessarFabrica } from "@/lib/authz";
import { obterFabricaIdDaNotaFiscal } from "@/lib/nota-fiscal-fabrica";
import { validarAberturaChamado } from "@/domain/chamado/validacao";

export async function abrirChamado(formData: FormData): Promise<{ erros: string[]; chamadoId?: string }> {
  const notaFiscalId = String(formData.get("notaFiscalId") ?? "");
  const motivoId = String(formData.get("motivoId") ?? "");
  const observacao = String(formData.get("observacao") ?? "");
  const itensAfetadosIds = formData.getAll("itemPedidoId").map(String);

  const erros = validarAberturaChamado({ notaFiscalId, motivoId, observacao, itensAfetadosIds });
  if (erros.length > 0) return { erros };

  const usuario = await obterUsuarioLogado();
  if (!usuario) return { erros: ["Sessão expirada. Faça login novamente."] };

  const fabricaId = await obterFabricaIdDaNotaFiscal(notaFiscalId);
  if (!fabricaId || !podeAcessarFabrica(usuario, fabricaId)) {
    return { erros: ["Você não tem permissão para abrir chamados para esta NFe."] };
  }

  const motivo = await prisma.motivoChamado.findUnique({ where: { id: motivoId } });
  if (!motivo) return { erros: ["Motivo inválido."] };

  const chamado = await prisma.chamado.create({
    data: {
      notaFiscalId,
      motivoId,
      abertoPorId: usuario.id,
      itensAfetados: { create: itensAfetadosIds.map((itemPedidoId) => ({ itemPedidoId })) },
      eventos: {
        create: [
          {
            estado: "ABERTO",
            estadoAnterior: null,
            observacao: observacao.trim(),
            usuarioId: usuario.id,
          },
        ],
      },
    },
  });

  revalidatePath("/divergencias");
  return { erros: [], chamadoId: chamado.id };
}
```

- [ ] **Step 10: Run test to verify it passes**

Run: `npm test -- src/app/\(app\)/divergencias/__tests__/actions.test.ts`
Expected: PASS.

### Parte D — Telas

> Sem teste unitário dedicado — são server/client components de apresentação sem ramificação de regra própria (a validação e a autorização já estão cobertas nas Partes A/B/C), seguindo o precedente do repositório (`rastreio/[id]/page.tsx`, `rastreio-form.tsx`).

- [ ] **Step 11: Create the "nova" page**

Create `src/app/(app)/divergencias/nova/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { obterUsuarioLogado } from "@/lib/sessao";
import { buscarContextoAberturaChamado } from "../queries";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { ChamadoForm } from "./chamado-form";

export default async function NovoChamadoPage({
  searchParams,
}: {
  searchParams: Promise<{ notaFiscalId?: string }>;
}) {
  const { notaFiscalId } = await searchParams;
  if (!notaFiscalId) notFound();

  const usuario = await obterUsuarioLogado();
  if (!usuario) notFound();

  const contexto = await buscarContextoAberturaChamado(notaFiscalId, usuario);
  if (!contexto) notFound();

  const itensDisponiveis = contexto.notaFiscal.itensFaturados.map((faturado) => ({
    itemPedidoId: faturado.itemPedidoId,
    referencia: faturado.itemPedido.referencia,
    descricao: faturado.itemPedido.descricao,
    pedidoNumero: faturado.itemPedido.pedido.semNumero
      ? "S/N"
      : (faturado.itemPedido.pedido.numero ?? "S/N"),
  }));

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Abrir chamado — NFe {contexto.notaFiscal.numero}</CardTitle>
        </CardHeader>
      </Card>
      <ChamadoForm
        notaFiscalId={contexto.notaFiscal.id}
        motivos={contexto.motivos}
        itensDisponiveis={itensDisponiveis}
      />
    </div>
  );
}
```

- [ ] **Step 12: Create the client form**

Create `src/app/(app)/divergencias/nova/chamado-form.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { abrirChamado } from "../actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

type Motivo = { id: string; nome: string };
type ItemDisponivel = {
  itemPedidoId: string;
  referencia: string;
  descricao: string;
  pedidoNumero: string;
};

export function ChamadoForm({
  notaFiscalId,
  motivos,
  itensDisponiveis,
}: {
  notaFiscalId: string;
  motivos: Motivo[];
  itensDisponiveis: ItemDisponivel[];
}) {
  const router = useRouter();
  const [erros, setErros] = useState<string[]>([]);

  async function handleSubmit(formData: FormData) {
    const resultado = await abrirChamado(formData);
    if (resultado.erros.length > 0) {
      setErros(resultado.erros);
      return;
    }
    router.push(`/divergencias/${resultado.chamadoId}`);
  }

  return (
    <Card className="max-w-2xl">
      <CardContent>
        <form action={handleSubmit} className="flex flex-col gap-4">
          <input type="hidden" name="notaFiscalId" value={notaFiscalId} />

          <div className="flex flex-col gap-2">
            <Label htmlFor="motivoId">Motivo</Label>
            <select id="motivoId" name="motivoId" className="rounded-md border px-3 py-2 text-sm" required>
              <option value="">Selecione...</option>
              {motivos.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome}
                </option>
              ))}
            </select>
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium">Itens afetados</legend>
            {itensDisponiveis.map((item) => (
              <label key={item.itemPedidoId} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="itemPedidoId" value={item.itemPedidoId} />
                Pedido {item.pedidoNumero} · {item.referencia} — {item.descricao}
              </label>
            ))}
          </fieldset>

          <div className="flex flex-col gap-2">
            <Label htmlFor="observacao">Descrição da divergência</Label>
            <textarea
              id="observacao"
              name="observacao"
              className="rounded-md border px-3 py-2 text-sm"
              rows={4}
              required
            />
          </div>

          {erros.map((erro) => (
            <p key={erro} className="text-sm text-destructive">
              {erro}
            </p>
          ))}
          <Button type="submit">Abrir chamado</Button>
        </form>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 13: Add the entry point on the NFe cruzamento screen**

Em `src/app/(app)/conferencia/[id]/page.tsx`, adicione o import de `Link` (se ainda não houver) e o link no cabeçalho. Localize o bloco:

```tsx
      <Card>
        <CardHeader>
          <CardTitle>Cruzamento — NFe {notaFiscal.numero}</CardTitle>
          <p className="text-sm text-muted-foreground">Chave: {notaFiscal.chaveAcesso}</p>
        </CardHeader>
      </Card>
```

Substitua por:

```tsx
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Cruzamento — NFe {notaFiscal.numero}</CardTitle>
            <p className="text-sm text-muted-foreground">Chave: {notaFiscal.chaveAcesso}</p>
          </div>
          <Link href={`/divergencias/nova?notaFiscalId=${notaFiscal.id}`} className="underline">
            Abrir chamado
          </Link>
        </CardHeader>
      </Card>
```

E adicione `import Link from "next/link";` junto aos demais imports no topo do arquivo.

- [ ] **Step 14: Run the full test suite once more**

Run: `npm test`
Expected: PASS (o teste de autorização da Parte B continua verde; as telas não têm teste próprio, verificação manual fica para a Definition of Done do épico).

- [ ] **Step 15: Commit**

```bash
git add src/app/\(app\)/divergencias/queries.ts src/app/\(app\)/divergencias/actions.ts \
  src/app/\(app\)/divergencias/nova src/app/\(app\)/conferencia/\[id\]/page.tsx \
  src/app/\(app\)/divergencias/__tests__/actions.test.ts
git commit -m "feat: abrir chamado de divergência a partir da NFe (RF25/RF30)"
```

---

## Task 5: Seed dos motivos de divergência (RF26)

**Files:**
- Modify: `prisma/seed.ts`
- Test: `src/lib/__tests__/motivos-chamado.test.ts`

**Interfaces:**
- Consumes: `prisma.motivoChamado` (Task 3).
- Produces: 6 linhas seedadas em `MotivoChamado` (RF26).

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/motivos-chamado.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { prisma } from "../prisma";

const MOTIVOS_ESPERADOS = [
  "Itens errados",
  "Item faltando",
  "Item quebrado",
  "Acionar garantia",
  "NFe com valor errado",
  "Extravio",
];

describe("seed de motivos de divergência (RF26)", () => {
  it("contém os 6 motivos do PRD após o seed", async () => {
    const motivos = await prisma.motivoChamado.findMany({ where: { nome: { in: MOTIVOS_ESPERADOS } } });
    const nomes = motivos.map((m) => m.nome).sort();
    expect(nomes).toEqual([...MOTIVOS_ESPERADOS].sort());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/__tests__/motivos-chamado.test.ts`
Expected: FAIL — array vazio, os motivos ainda não foram seedados.

- [ ] **Step 3: Add the seed**

Em `prisma/seed.ts`, adicione dentro de `main()` (após os `upsert` de `Parametro` existentes):

```ts
  const motivosDivergencia = [
    "Itens errados",
    "Item faltando",
    "Item quebrado",
    "Acionar garantia",
    "NFe com valor errado",
    "Extravio",
  ];
  for (const nome of motivosDivergencia) {
    await prisma.motivoChamado.upsert({ where: { nome }, update: {}, create: { nome } });
  }
```

- [ ] **Step 4: Run the seed**

Run: `npx prisma db seed`
Expected: `Running seed command \`tsx prisma/seed.ts\` ...` seguido de sucesso, sem erros.

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- src/lib/__tests__/motivos-chamado.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add prisma/seed.ts src/lib/__tests__/motivos-chamado.test.ts
git commit -m "feat: seed dos motivos de divergência (RF26)"
```

---

## Task 6: Lista de divergências + detalhe com thread (RF27/RF28)

**Files:**
- Modify: `src/app/(app)/divergencias/queries.ts` (adicionar `buscarChamadosPermitidos`, `buscarChamadoComPermissao`)
- Modify: `src/app/(app)/divergencias/actions.ts` (adicionar `registrarEventoChamado`)
- Create: `src/app/(app)/divergencias/page.tsx`
- Create: `src/app/(app)/divergencias/[id]/page.tsx`
- Create: `src/app/(app)/divergencias/[id]/chamado-evento-form.tsx`
- Modify: `src/app/(app)/divergencias/__tests__/actions.test.ts` (adicionar caso de `registrarEventoChamado`)
- Modify: `e2e/smoke.spec.ts`

**Interfaces:**
- Consumes: `Chamado`/`EventoChamado` (Task 3), `transicaoChamadoValida`/`proximosEstadosChamado` de `@/domain/chamado/estado` (Task 1), `podeAcessarFabrica`/`obterFabricaIdDaNotaFiscal` (ADR-009).
- Produces:
  - `async function buscarChamadosPermitidos(usuario: UsuarioSessao)` (usado também pela Task 7, que adiciona o campo `critico`)
  - `async function buscarChamadoComPermissao(id: string, usuario: UsuarioSessao)`
  - `async function registrarEventoChamado(chamadoId: string, novoEstado: EstadoChamado, observacao: string): Promise<{ erros: string[] }>`

> **Nota de ordem de execução:** por simplicidade de leitura do plano, este arquivo apresenta `buscarChamadosPermitidos` **sem** o campo `critico` (adicionado na Task 7). Se preferir implementar direto com o campo `critico`, pule para a versão completa da Task 7, Step 3, e não repita este passo.

### Parte A — Queries de lista/detalhe

- [ ] **Step 1: Extend the queries file**

Em `src/app/(app)/divergencias/queries.ts`, adicione ao final do arquivo:

```ts
export async function buscarChamadosPermitidos(usuario: UsuarioSessao) {
  const fabricasPermitidas = filtroFabricasPermitidas(usuario);
  return prisma.chamado.findMany({
    where: fabricasPermitidas
      ? { notaFiscal: { pedidos: { some: { pedido: { fabricaId: { in: fabricasPermitidas } } } } } }
      : {},
    include: {
      notaFiscal: true,
      motivo: true,
      eventos: { orderBy: { criadoEm: "desc" }, take: 1 },
    },
    orderBy: { criadoEm: "desc" },
  });
}

export async function buscarChamadoComPermissao(id: string, usuario: UsuarioSessao) {
  const chamado = await prisma.chamado.findUnique({
    where: { id },
    include: {
      notaFiscal: true,
      motivo: true,
      itensAfetados: { include: { itemPedido: true } },
      eventos: { orderBy: { criadoEm: "desc" }, include: { usuario: true } },
    },
  });
  if (!chamado) return null;

  const fabricaId = await obterFabricaIdDaNotaFiscal(chamado.notaFiscalId);
  if (!fabricaId || !podeAcessarFabrica(usuario, fabricaId)) return null;

  return chamado;
}
```

E adicione `filtroFabricasPermitidas` ao import já existente de `@/lib/authz` no topo do arquivo:

```ts
import { filtroFabricasPermitidas, podeAcessarFabrica } from "@/lib/authz";
```

### Parte B — Teste de integração de `registrarEventoChamado` (RED)

- [ ] **Step 2: Write the failing test**

Em `src/app/(app)/divergencias/__tests__/actions.test.ts`, troque o import de `abrirChamado` por:

```ts
import { abrirChamado, registrarEventoChamado } from "../actions";
```

E adicione um novo `describe` ao final do arquivo:

```ts
describe("registrarEventoChamado — autorização por fábrica (ADR-009)", () => {
  it("recusa registrar andamento quando o usuário não tem permissão na fábrica da NFe", async () => {
    const fabrica = await prisma.fabrica.create({ data: { nome: "Fábrica Chamado Evento", cnpj: "90000000002176" } });
    const cliente = await prisma.cliente.create({ data: { cnpj: "90000000002257", nomeFantasia: "Cliente Chamado Evento" } });
    const usuarioAbertura = await prisma.usuario.create({ data: { nome: "Abertura", email: "chamado-evento-abertura@teste.dev" } });
    const pedido = await prisma.pedido.create({
      data: { numero: "PED-CHEV-1", origem: "MANUAL", fabricaId: fabrica.id, clienteId: cliente.id },
    });
    const nota = await prisma.notaFiscal.create({
      data: {
        numero: "9302", chaveAcesso: "35260790000000002176550010000093021123456789",
        emitenteCnpj: fabrica.cnpj, destinatarioCnpj: cliente.cnpj,
        dataEmissao: new Date("2026-07-01T10:00:00-03:00"), totalProdutos: 50, totalNota: 55,
        pedidos: { create: [{ pedidoId: pedido.id }] },
      },
    });
    const motivo = await prisma.motivoChamado.create({ data: { nome: "Item faltando (teste evento)" } });
    const chamado = await prisma.chamado.create({
      data: {
        notaFiscalId: nota.id,
        motivoId: motivo.id,
        abertoPorId: usuarioAbertura.id,
        eventos: { create: [{ estado: "ABERTO", estadoAnterior: null, observacao: "Faltou item.", usuarioId: usuarioAbertura.id }] },
      },
    });

    try {
      obterUsuarioLogadoMock.mockResolvedValue({ id: "u2", nome: "Op2", perfil: "OPERADOR", fabricasIds: ["outra"] });

      const resultado = await registrarEventoChamado(chamado.id, "EM_TRATATIVA", "Assumindo o caso.");

      expect(resultado.erros).toEqual(["Você não tem permissão para atualizar este chamado."]);

      const chamadoInalterado = await prisma.chamado.findUnique({ where: { id: chamado.id } });
      expect(chamadoInalterado?.estado).toBe("ABERTO");

      const eventos = await prisma.eventoChamado.findMany({ where: { chamadoId: chamado.id } });
      expect(eventos).toHaveLength(1);
    } finally {
      await prisma.eventoChamado.deleteMany({ where: { chamadoId: chamado.id } });
      await prisma.chamado.delete({ where: { id: chamado.id } });
      await prisma.motivoChamado.delete({ where: { id: motivo.id } });
      await prisma.notaFiscalPedido.deleteMany({ where: { notaFiscalId: nota.id } });
      await prisma.notaFiscal.delete({ where: { id: nota.id } });
      await prisma.pedido.delete({ where: { id: pedido.id } });
      await prisma.usuario.delete({ where: { id: usuarioAbertura.id } });
      await prisma.cliente.delete({ where: { id: cliente.id } });
      await prisma.fabrica.delete({ where: { id: fabrica.id } });
    }
  }, 15000);
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- src/app/\(app\)/divergencias/__tests__/actions.test.ts`
Expected: FAIL — `registrarEventoChamado` não é exportado por `../actions` (a função ainda não existe).

### Parte C — Server action `registrarEventoChamado` (GREEN)

- [ ] **Step 4: Extend the actions file**

Em `src/app/(app)/divergencias/actions.ts`, adicione ao final do arquivo:

```ts
export async function registrarEventoChamado(
  chamadoId: string,
  novoEstado: EstadoChamado,
  observacao: string,
): Promise<{ erros: string[] }> {
  const usuario = await obterUsuarioLogado();
  if (!usuario) return { erros: ["Sessão expirada. Faça login novamente."] };

  const chamado = await prisma.chamado.findUnique({ where: { id: chamadoId } });
  if (!chamado) return { erros: ["Chamado não encontrado."] };

  const fabricaId = await obterFabricaIdDaNotaFiscal(chamado.notaFiscalId);
  if (!fabricaId || !podeAcessarFabrica(usuario, fabricaId)) {
    return { erros: ["Você não tem permissão para atualizar este chamado."] };
  }

  const estadoAtual = chamado.estado as EstadoChamado;
  if (!transicaoChamadoValida(estadoAtual, novoEstado)) {
    return { erros: [`Não é possível mudar o chamado de ${estadoAtual} para ${novoEstado}.`] };
  }

  if (!observacao.trim()) {
    return { erros: ["Descreva o andamento (observação obrigatória)."] };
  }

  await prisma.eventoChamado.create({
    data: {
      chamadoId: chamado.id,
      estadoAnterior: estadoAtual,
      estado: novoEstado,
      observacao: observacao.trim(),
      usuarioId: usuario.id,
    },
  });
  await prisma.chamado.update({ where: { id: chamado.id }, data: { estado: novoEstado } });

  revalidatePath(`/divergencias/${chamado.id}`);
  revalidatePath("/divergencias");
  return { erros: [] };
}
```

E adicione ao topo do arquivo, junto aos demais imports:

```ts
import { transicaoChamadoValida, type EstadoChamado } from "@/domain/chamado/estado";
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- src/app/\(app\)/divergencias/__tests__/actions.test.ts`
Expected: PASS (os dois `describe`, `abrirChamado` e `registrarEventoChamado`).

### Parte D — Telas

- [ ] **Step 6: Create the list page**

Create `src/app/(app)/divergencias/page.tsx`:

```tsx
import Link from "next/link";
import { obterUsuarioLogado } from "@/lib/sessao";
import { buscarChamadosPermitidos } from "./queries";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function DivergenciasPage() {
  const usuario = await obterUsuarioLogado();
  if (!usuario) {
    return <p className="text-sm text-red-600">Sessão expirada. Faça login novamente.</p>;
  }

  const chamados = await buscarChamadosPermitidos(usuario);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Divergências</CardTitle>
        </CardHeader>
      </Card>

      {chamados.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum chamado aberto ainda.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>NFe</TableHead>
              <TableHead>Motivo</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {chamados.map((chamado) => (
              <TableRow key={chamado.id}>
                <TableCell>{chamado.notaFiscal.numero}</TableCell>
                <TableCell>{chamado.motivo.nome}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{chamado.estado}</Badge>
                    {chamado.critico && <Badge variant="destructive">CRÍTICO</Badge>}
                  </div>
                </TableCell>
                <TableCell>
                  <Link href={`/divergencias/${chamado.id}`} className="underline">
                    Ver
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

> O campo `chamado.critico` só existe a partir da Task 7. Como este plano é executado tarefa a tarefa em ordem, ao terminar a Task 6 o TypeScript vai reclamar de `critico` não existir no tipo retornado por `buscarChamadosPermitidos` — isso é esperado e resolvido na Task 7, Step 3 (não é um erro a corrigir aqui).

- [ ] **Step 7: Create the detail page**

Create `src/app/(app)/divergencias/[id]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { obterUsuarioLogado } from "@/lib/sessao";
import { buscarChamadoComPermissao } from "../queries";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { proximosEstadosChamado, type EstadoChamado } from "@/domain/chamado/estado";
import { ChamadoEventoForm } from "./chamado-evento-form";

export default async function DetalheChamadoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const usuario = await obterUsuarioLogado();
  if (!usuario) notFound();

  const chamado = await buscarChamadoComPermissao(id, usuario);
  if (!chamado) notFound();

  const proximos = proximosEstadosChamado(chamado.estado as EstadoChamado);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Chamado — NFe {chamado.notaFiscal.numero}</CardTitle>
            <p className="text-sm text-muted-foreground">{chamado.motivo.nome}</p>
          </div>
          <Badge variant="outline">{chamado.estado}</Badge>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Itens afetados</CardTitle>
        </CardHeader>
        <ul className="flex flex-col gap-1 px-6 pb-6 text-sm">
          {chamado.itensAfetados.map(({ itemPedido }) => (
            <li key={itemPedido.id}>
              {itemPedido.referencia} — {itemPedido.descricao}
            </li>
          ))}
        </ul>
      </Card>

      {proximos.length > 0 ? (
        <ChamadoEventoForm chamadoId={chamado.id} proximos={proximos} />
      ) : (
        <p className="text-sm text-muted-foreground">
          Chamado resolvido. Não há próximas transições.
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Histórico</CardTitle>
        </CardHeader>
        <ul className="flex flex-col gap-2 px-6 pb-6 text-sm">
          {chamado.eventos.map((evento) => (
            <li key={evento.id} className="border-b pb-2">
              <span className="font-medium">
                {evento.estadoAnterior ? `${evento.estadoAnterior} → ${evento.estado}` : `Aberto (${evento.estado})`}
              </span>{" "}
              <span className="text-muted-foreground">
                ({new Date(evento.criadoEm).toLocaleString("pt-BR")} · {evento.usuario.nome})
              </span>
              <p className="text-muted-foreground">{evento.observacao}</p>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
```

- [ ] **Step 8: Create the client form for advancing the chamado**

Create `src/app/(app)/divergencias/[id]/chamado-evento-form.tsx`:

```tsx
"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { registrarEventoChamado } from "../actions";
import type { EstadoChamado } from "@/domain/chamado/estado";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ChamadoEventoForm({
  chamadoId,
  proximos,
}: {
  chamadoId: string;
  proximos: EstadoChamado[];
}) {
  const router = useRouter();
  const [estado, setEstado] = useState<EstadoChamado>(proximos[0]);
  const [observacao, setObservacao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setErro(null);
    const resultado = await registrarEventoChamado(chamadoId, estado, observacao);
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
        <CardTitle>Registrar andamento</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          <div className="flex flex-wrap items-end gap-2">
            <select
              className="rounded-md border px-2 py-1 text-sm"
              value={estado}
              onChange={(e) => setEstado(e.target.value as EstadoChamado)}
            >
              {proximos.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <Button type="submit" disabled={enviando}>
              Registrar
            </Button>
          </div>
          <textarea
            className="rounded-md border px-2 py-1 text-sm"
            placeholder="Observação (obrigatória)"
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            required
            rows={2}
          />
        </form>
        {erro && <p className="mt-2 text-sm text-destructive">{erro}</p>}
      </CardContent>
    </Card>
  );
}
```

### Parte E — Smoke e2e

- [ ] **Step 9: Add the redirect checks**

Em `e2e/smoke.spec.ts`, adicione ao final do arquivo:

```ts
test("visitante não logado é redirecionado de /divergencias", async ({ page }) => {
  await page.goto("/divergencias");
  await expect(page).toHaveURL(/\/login/);
});

test("visitante não logado é redirecionado de /divergencias/nova", async ({ page }) => {
  await page.goto("/divergencias/nova");
  await expect(page).toHaveURL(/\/login/);
});
```

- [ ] **Step 10: Run the e2e suite**

Run: `npm run e2e`
Expected: PASS (todos os redirecionamentos, incluindo os dois novos).

- [ ] **Step 11: Commit**

```bash
git add src/app/\(app\)/divergencias/queries.ts src/app/\(app\)/divergencias/actions.ts \
  src/app/\(app\)/divergencias/page.tsx src/app/\(app\)/divergencias/\[id\] \
  src/app/\(app\)/divergencias/__tests__/actions.test.ts e2e/smoke.spec.ts
git commit -m "feat: lista e thread de andamento de divergências (RF27/RF28)"
```

---

## Task 7: Parâmetro de prazo crítico + sinalização na fila (RF29)

**Files:**
- Create: `src/lib/parametros.ts`
- Test: `src/lib/__tests__/parametros.test.ts`
- Modify: `src/app/(app)/divergencias/queries.ts` (`buscarChamadosPermitidos` ganha o campo `critico` e ordenação)
- Test: `src/app/(app)/divergencias/__tests__/queries.test.ts`

**Interfaces:**
- Consumes: `prisma.parametro` (já existente desde o Épico 1), `estaCritico` de `@/domain/chamado/inatividade` (Task 2).
- Produces:
  - `async function obterParametroNumero(chave: string, padrao: number): Promise<number>`
  - `buscarChamadosPermitidos` retorna cada chamado com `critico: boolean`, ordenado com críticos primeiro e, dentro de cada grupo, mais recentes primeiro.

### Parte A — Helper de parâmetro (TDD)

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/parametros.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { prisma } from "../prisma";
import { obterParametroNumero } from "../parametros";

describe("obterParametroNumero (ADR-006: prazos configuráveis)", () => {
  it("lê o valor numérico gravado no parâmetro", async () => {
    await prisma.parametro.upsert({
      where: { chave: "teste_prazo_dias" },
      update: { valor: "45" },
      create: { chave: "teste_prazo_dias", valor: "45" },
    });

    const valor = await obterParametroNumero("teste_prazo_dias", 10);
    expect(valor).toBe(45);

    await prisma.parametro.delete({ where: { chave: "teste_prazo_dias" } });
  });

  it("usa o padrão quando o parâmetro não existe", async () => {
    const valor = await obterParametroNumero("chave_inexistente_xyz_teste", 30);
    expect(valor).toBe(30);
  });

  it("usa o padrão quando o valor gravado não é numérico", async () => {
    await prisma.parametro.upsert({
      where: { chave: "teste_prazo_invalido" },
      update: { valor: "abc" },
      create: { chave: "teste_prazo_invalido", valor: "abc" },
    });

    const valor = await obterParametroNumero("teste_prazo_invalido", 30);
    expect(valor).toBe(30);

    await prisma.parametro.delete({ where: { chave: "teste_prazo_invalido" } });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/__tests__/parametros.test.ts`
Expected: FAIL — `Failed to resolve import "../parametros"`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/parametros.ts`:

```ts
import { prisma } from "./prisma";

export async function obterParametroNumero(chave: string, padrao: number): Promise<number> {
  const parametro = await prisma.parametro.findUnique({ where: { chave } });
  if (!parametro) return padrao;

  const valor = Number(parametro.valor);
  return Number.isFinite(valor) ? valor : padrao;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/__tests__/parametros.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/parametros.ts src/lib/__tests__/parametros.test.ts
git commit -m "feat: leitura de parâmetros configuráveis com fallback (ADR-006)"
```

### Parte B — Wiring na lista de divergências

- [ ] **Step 6: Write the failing test**

Create `src/app/(app)/divergencias/__tests__/queries.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import { buscarChamadosPermitidos } from "../queries";

describe("buscarChamadosPermitidos — sinalização de crítico (RF29)", () => {
  it("marca como crítico o chamado sem evento há mais de 30 dias e o ordena primeiro", async () => {
    const fabrica = await prisma.fabrica.create({ data: { nome: "Fábrica Fila Crítica", cnpj: "90000000002177" } });
    const cliente = await prisma.cliente.create({ data: { cnpj: "90000000002258", nomeFantasia: "Cliente Fila Crítica" } });
    const usuario = await prisma.usuario.create({ data: { nome: "Analista Fila", email: "fila-critica@teste.dev" } });
    const pedido = await prisma.pedido.create({
      data: { numero: "PED-FILA-1", origem: "MANUAL", fabricaId: fabrica.id, clienteId: cliente.id },
    });
    const nota = await prisma.notaFiscal.create({
      data: {
        numero: "9303", chaveAcesso: "35260790000000002177550010000093031123456789",
        emitenteCnpj: fabrica.cnpj, destinatarioCnpj: cliente.cnpj,
        dataEmissao: new Date("2026-05-01T10:00:00-03:00"), totalProdutos: 50, totalNota: 55,
        pedidos: { create: [{ pedidoId: pedido.id }] },
      },
    });
    const motivo = await prisma.motivoChamado.create({ data: { nome: "Item quebrado (teste fila)" } });

    const chamadoAntigo = await prisma.chamado.create({
      data: {
        notaFiscalId: nota.id, motivoId: motivo.id, abertoPorId: usuario.id,
        eventos: { create: [{ estado: "ABERTO", estadoAnterior: null, observacao: "Aberto há muito tempo.", usuarioId: usuario.id }] },
      },
    });
    await prisma.eventoChamado.updateMany({
      where: { chamadoId: chamadoAntigo.id },
      data: { criadoEm: new Date("2026-05-01T00:00:00-03:00") },
    });

    const chamadoRecente = await prisma.chamado.create({
      data: {
        notaFiscalId: nota.id, motivoId: motivo.id, abertoPorId: usuario.id,
        eventos: { create: [{ estado: "ABERTO", estadoAnterior: null, observacao: "Aberto agora.", usuarioId: usuario.id }] },
      },
    });

    try {
      const usuarioSessao = { id: usuario.id, nome: usuario.nome, perfil: "ADMIN" as const, fabricasIds: [] };
      const chamados = await buscarChamadosPermitidos(usuarioSessao);
      const encontrados = chamados.filter((c) => [chamadoAntigo.id, chamadoRecente.id].includes(c.id));

      const antigo = encontrados.find((c) => c.id === chamadoAntigo.id);
      const recente = encontrados.find((c) => c.id === chamadoRecente.id);
      expect(antigo?.critico).toBe(true);
      expect(recente?.critico).toBe(false);

      const indiceAntigo = encontrados.findIndex((c) => c.id === chamadoAntigo.id);
      const indiceRecente = encontrados.findIndex((c) => c.id === chamadoRecente.id);
      expect(indiceAntigo).toBeLessThan(indiceRecente);
    } finally {
      await prisma.eventoChamado.deleteMany({ where: { chamadoId: { in: [chamadoAntigo.id, chamadoRecente.id] } } });
      await prisma.chamado.deleteMany({ where: { id: { in: [chamadoAntigo.id, chamadoRecente.id] } } });
      await prisma.motivoChamado.delete({ where: { id: motivo.id } });
      await prisma.notaFiscalPedido.deleteMany({ where: { notaFiscalId: nota.id } });
      await prisma.notaFiscal.delete({ where: { id: nota.id } });
      await prisma.pedido.delete({ where: { id: pedido.id } });
      await prisma.usuario.delete({ where: { id: usuario.id } });
      await prisma.cliente.delete({ where: { id: cliente.id } });
      await prisma.fabrica.delete({ where: { id: fabrica.id } });
    }
  }, 15000);
});
```

- [ ] **Step 7: Run test to verify it fails**

Run: `npm test -- src/app/\(app\)/divergencias/__tests__/queries.test.ts`
Expected: FAIL — `chamado.critico` é `undefined` (a lista ainda não calcula o campo).

- [ ] **Step 8: Wire `estaCritico` into `buscarChamadosPermitidos`**

Em `src/app/(app)/divergencias/queries.ts`, substitua a função `buscarChamadosPermitidos` (criada na Task 6) por:

```ts
export async function buscarChamadosPermitidos(usuario: UsuarioSessao) {
  const fabricasPermitidas = filtroFabricasPermitidas(usuario);
  const prazoDias = await obterParametroNumero("prazo_chamado_critico_dias", 30);

  const chamados = await prisma.chamado.findMany({
    where: fabricasPermitidas
      ? { notaFiscal: { pedidos: { some: { pedido: { fabricaId: { in: fabricasPermitidas } } } } } }
      : {},
    include: {
      notaFiscal: true,
      motivo: true,
      eventos: { orderBy: { criadoEm: "desc" }, take: 1 },
    },
    orderBy: { criadoEm: "desc" },
  });

  const agora = new Date();
  return chamados
    .map((chamado) => ({
      ...chamado,
      critico:
        chamado.estado !== "RESOLVIDO" && estaCritico(chamado.eventos[0].criadoEm, agora, prazoDias),
    }))
    .sort((a, b) => {
      if (a.critico !== b.critico) return a.critico ? -1 : 1;
      return b.criadoEm.getTime() - a.criadoEm.getTime();
    });
}
```

E adicione os dois novos imports ao topo do arquivo:

```ts
import { estaCritico } from "@/domain/chamado/inatividade";
import { obterParametroNumero } from "@/lib/parametros";
```

- [ ] **Step 9: Run test to verify it passes**

Run: `npm test -- src/app/\(app\)/divergencias/__tests__/queries.test.ts`
Expected: PASS.

- [ ] **Step 10: Run the full test suite**

Run: `npm test`
Expected: PASS (todos os testes do repositório, incluindo os das Tasks 1-6 e o teste de tipos de `divergencias/page.tsx` — o campo `critico` agora existe no tipo retornado).

- [ ] **Step 11: Commit**

```bash
git add src/app/\(app\)/divergencias/queries.ts src/app/\(app\)/divergencias/__tests__/queries.test.ts
git commit -m "feat: sinaliza e ordena chamados críticos na fila de divergências (RF29)"
```

---

## Definition of Done do Épico 6

- [ ] `npm test` verde (unidade + integração contra Postgres real).
- [ ] `npm run e2e` verde (redirecionamentos de `/divergencias` e `/divergencias/nova`).
- [ ] Fluxo demonstrável manualmente: abrir `/conferencia/[id]` de uma NFe → "Abrir chamado" → selecionar motivo + itens → salvar → cai em `/divergencias/[id]` com o evento de abertura na thread → avançar estado com observação → `/divergencias` mostra o chamado com o estado atualizado e, se sem evento há 30+ dias, com o badge CRÍTICO no topo da lista.
- [ ] RF25, RF26, RF27, RF28, RF29, RF30 cobertos por teste.
- [ ] `finishing-a-development-branch` executado (merge para `main`, branch encerrada).
