# Épico 7 — Análise, Alertas & Auditoria — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fechar o MVP com o painel PEDIDOS×NFE (gap só de produtos), a central de alertas de pedido sem NFe, o dashboard com KPIs reais e fila do dia, a consulta de auditoria e a exportação XLSX das listas.

**Architecture:** Três funções puras de domínio sob `src/domain/` (gap, alerta sem-NFe, gerador de XLSX), com TDD isolado de banco/Next. As telas (`/pedidos-x-nfe`, `/alertas`, `/auditoria`, e o dashboard `/`) são server components finos que buscam via Prisma (respeitando `filtroFabricasPermitidas`, ADR-009) e delegam apresentação a client components-tabela, seguindo o padrão já usado em `/rastreio` e `/divergencias`. A exportação é servida por route handlers (`src/app/api/export/...`) protegidos pelo proxy de autenticação; os botões de export são simples links para essas rotas, carregando os filtros vigentes na querystring — sem JavaScript de cliente.

**Tech Stack:** TypeScript (strict), Next.js App Router (`src/`), Prisma + PostgreSQL (Supabase), Supabase Auth, Tailwind v4 + Untitled UI React OSS/MIT (React Aria) — ver `DESIGN_SYSTEM.md`, ExcelJS (já é dependência), Vitest (unidade), Playwright (smoke de redirecionamento).

## Global Constraints

- **TDD sempre:** RED → GREEN → REFACTOR. Nenhum código de produção sem um teste que falhou antes. Regras de negócio (cálculo do gap, vencimento do alerta, geração da planilha) moram no domínio puro e são 100% cobertas por teste; server components/route handlers são *finos* (busca + autorização + chamada ao domínio), sem ramificação de regra própria.
- **YAGNI:** só o que o Épico 7 exige. Sem tela de parâmetros configuráveis (os prazos já são lidos de `Parametro` com fallback via `obterParametroNumero`; editar é SQL no MVP). Sem biblioteca de gráficos (o resumo mensal do gap é um gráfico de barras em CSS puro). Sem export agendado/assíncrono.
- **DRY:** autorização por fábrica reaproveita `filtroFabricasPermitidas`/`podeAcessarFabrica` de `@/lib/authz`. A fila de chamados críticos reaproveita `buscarChamadosPermitidos` (já calcula `critico`, Épico 6). A leitura de prazos reaproveita `obterParametroNumero` de `@/lib/parametros`.
- **Domínio puro** sob `src/domain/` não importa Next/Prisma/Supabase. Nomes em português.
- **Commits pequenos**, um por tarefa concluída.
- **ADR-007 é a fonte de verdade do gap:** compara **valor de produtos** do pedido com **valor de produtos** faturado, excluindo frete/impostos.
- **ADR-006 é a fonte de verdade dos prazos:** `prazo_alerta_sem_nfe_dias = 7` e `prazo_chamado_critico_dias = 30`, ambos únicos e globais, lidos de `Parametro` com fallback de código.
- **Verificação neste ambiente (sem `DATABASE_URL`):** `npx vitest run src/domain` + `npx tsc --noEmit` + `npm run build`. Testes de integração contra Postgres e e2e Playwright rodam em CI/staging (ver `DESIGN_SYSTEM.md`).

## Decisões de design (registrar no PR; não requerem novo ADR)

1. **Gap calculado no nível do item, agregado por mês/fábrica/cliente.** O valor de produtos faturados de um pedido é `Σ (quantidadeFaturada × valorUnitario do item)` — isto é produtos puros (o `valorUnitario` do item não inclui frete/imposto), honrando ADR-007 ("produtos × produtos"). Usar o item resolve a atribuição quando uma NFe cobre vários pedidos (RN10), coisa que somar `NotaFiscal.totalProdutos` cru não permitiria por pedido. O `totalNota` continua fora do cálculo, como manda o ADR.
2. **Mês do gap = mês de criação do pedido (`criadoEm`), em UTC.** O gap é uma medida ancorada no pedido (o quanto dele ainda não faturou); o mês natural é o da abertura do pedido. UTC evita que o agrupamento oscile com o fuso da máquina.
3. **KPI "Conferências pendentes" do placeholder é substituído por "Alertas (sem NFe)".** Não existe entidade persistida de "conferência pendente" no modelo (a `NotaFiscal` só nasce após a baixa confirmada), então o cartão antigo não tinha fonte de dados. Os 4 KPIs passam a ser: Pedidos ativos, NFes em trânsito, Divergências abertas, Alertas (pedidos sem NFe vencidos) — todos computáveis.
4. **Fila do dia = pedidos sem NFe vencidos + chamados críticos, juntos.** É uma leitura combinada dos dois alertas do MVP (ADR-006), ordenada por urgência, com link "ver tudo" para `/alertas` e `/divergencias`.
5. **Central de alertas (`/alertas`) lista todos os pedidos sem NFe vencidos (RF34); o dashboard mostra só um resumo.** A regra de vencimento é a mesma função de domínio nas duas telas.
6. **Consulta de auditoria (`/auditoria`) é visível a qualquer usuário logado e NÃO é filtrada por fábrica.** `EventoAuditoria` não tem vínculo de fábrica no schema (é um log transversal). Escopo por fábrica do log fica fora do MVP — limitação documentada; nenhum ADR pede o contrário.
7. **Export via route handler + link, sem client JS.** O botão de export é um `Button href` para `/api/export/...`, que recalcula as linhas com os mesmos filtros da querystring e devolve o arquivo. Isso evita serializar bytes por server action e mantém a tela fina.

---

## File Structure

- **Create** `src/domain/analise/gap.ts` (+ `__tests__/gap.test.ts`) — `calcularGap` puro (ADR-007).
- **Create** `src/domain/alerta/semNfe.ts` (+ `__tests__/semNfe.test.ts`) — `pedidosSemNfeVencidos` puro (ADR-006).
- **Create** `src/domain/export/xlsx.ts` (+ `__tests__/xlsx.test.ts`) — `gerarXlsx` genérico (ExcelJS, RF33).
- **Create** `src/app/(app)/pedidos-x-nfe/queries.ts` — `buscarPedidosParaGap`.
- **Create** `src/app/(app)/pedidos-x-nfe/page.tsx` — painel (RF31): filtros + resumo + tabela + export.
- **Create** `src/app/(app)/pedidos-x-nfe/pedidos-x-nfe-filtros.tsx` — filtros (client, form GET).
- **Create** `src/app/(app)/pedidos-x-nfe/pedidos-x-nfe-tabela.tsx` — tabela (client).
- **Create** `src/app/(app)/alertas/queries.ts` — `buscarPedidosParaAlerta`.
- **Create** `src/app/(app)/alertas/page.tsx` — central de alertas (RF34).
- **Create** `src/app/(app)/alertas/alertas-tabela.tsx` — tabela (client).
- **Create** `src/app/(app)/auditoria/queries.ts` — `buscarEventosAuditoria`, `listarUsuariosParaFiltro`, `listarEntidadesAuditadas`.
- **Create** `src/app/(app)/auditoria/page.tsx` — consulta de auditoria (RF32).
- **Create** `src/app/(app)/auditoria/auditoria-filtros.tsx` — filtros (client, form GET).
- **Create** `src/app/(app)/auditoria/auditoria-tabela.tsx` — tabela (client).
- **Create** `src/app/(app)/queries.ts` — `buscarResumoDashboard` (KPIs + fila do dia).
- **Modify** `src/app/(app)/page.tsx` — dashboard com dados reais.
- **Create** `src/app/api/export/pedidos-x-nfe/route.ts`, `src/app/api/export/pedidos/route.ts`, `src/app/api/export/divergencias/route.ts`.
- **Modify** `src/app/(app)/pedidos/page.tsx` — botão "Exportar XLSX".
- **Modify** `src/app/(app)/divergencias/page.tsx` — botão "Exportar XLSX".
- **Modify** `src/components/nav-itens.ts` — item de menu "Auditoria".
- **Modify** `e2e/smoke.spec.ts` — redirecionamento de `/pedidos-x-nfe`, `/alertas`, `/auditoria`.

> As rotas `/pedidos-x-nfe` e `/alertas` já estão no menu (`src/components/nav-itens.ts`). A proteção de rota (`src/proxy.ts` + `src/lib/auth-guard.ts`) já cobre qualquer caminho não público — inclusive `/api/export/*` — sem mudança.

---

## Task 1: Cálculo do gap (domínio puro, ADR-007)

**Files:**
- Create: `src/domain/analise/gap.ts`
- Test: `src/domain/analise/__tests__/gap.test.ts`

**Interfaces:**
- Consumes: nada (função pura).
- Produces:
  - `type ItemPedidoGap = { quantidadePedida: number; valorUnitario: number }`
  - `type ItemFaturadoGap = { quantidadeFaturada: number; valorUnitario: number }`
  - `type PedidoParaGap = { fabrica: string; cliente: string; criadoEm: Date; itens: ItemPedidoGap[]; itensFaturados: ItemFaturadoGap[] }`
  - `type LinhaGap = { mes: string; fabrica: string; cliente: string; valorPedido: number; valorFaturado: number; gap: number }`
  - `function calcularGap(pedidos: PedidoParaGap[]): LinhaGap[]`

- [ ] **Step 1: Write the failing test**

Create `src/domain/analise/__tests__/gap.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { calcularGap, type PedidoParaGap } from "../gap";

describe("calcularGap (RF31, ADR-007)", () => {
  it("gap = valor pedido de produtos − valor faturado de produtos, por pedido", () => {
    const pedidos: PedidoParaGap[] = [
      {
        fabrica: "Bowden",
        cliente: "Cliente A",
        criadoEm: new Date("2026-07-10T12:00:00Z"),
        itens: [{ quantidadePedida: 10, valorUnitario: 5 }], // pedido = 50
        itensFaturados: [{ quantidadeFaturada: 4, valorUnitario: 5 }], // faturado = 20
      },
    ];
    expect(calcularGap(pedidos)).toEqual([
      { mes: "2026-07", fabrica: "Bowden", cliente: "Cliente A", valorPedido: 50, valorFaturado: 20, gap: 30 },
    ]);
  });

  it("agrupa por mês + fábrica + cliente, somando os pedidos do grupo", () => {
    const pedidos: PedidoParaGap[] = [
      {
        fabrica: "Bowden",
        cliente: "Cliente A",
        criadoEm: new Date("2026-07-05T12:00:00Z"),
        itens: [{ quantidadePedida: 2, valorUnitario: 10 }], // 20
        itensFaturados: [],
      },
      {
        fabrica: "Bowden",
        cliente: "Cliente A",
        criadoEm: new Date("2026-07-28T12:00:00Z"),
        itens: [{ quantidadePedida: 3, valorUnitario: 10 }], // 30
        itensFaturados: [{ quantidadeFaturada: 1, valorUnitario: 10 }], // 10
      },
    ];
    expect(calcularGap(pedidos)).toEqual([
      { mes: "2026-07", fabrica: "Bowden", cliente: "Cliente A", valorPedido: 50, valorFaturado: 10, gap: 40 },
    ]);
  });

  it("separa grupos de meses/fábricas/clientes diferentes e ordena por mês desc", () => {
    const pedidos: PedidoParaGap[] = [
      {
        fabrica: "Bowden",
        cliente: "Cliente A",
        criadoEm: new Date("2026-06-15T12:00:00Z"),
        itens: [{ quantidadePedida: 1, valorUnitario: 100 }],
        itensFaturados: [],
      },
      {
        fabrica: "Autoflex",
        cliente: "Cliente B",
        criadoEm: new Date("2026-07-15T12:00:00Z"),
        itens: [{ quantidadePedida: 1, valorUnitario: 200 }],
        itensFaturados: [],
      },
    ];
    const linhas = calcularGap(pedidos);
    expect(linhas.map((l) => `${l.mes}|${l.fabrica}|${l.cliente}`)).toEqual([
      "2026-07|Autoflex|Cliente B",
      "2026-06|Bowden|Cliente A",
    ]);
  });

  it("retorna vazio para lista vazia", () => {
    expect(calcularGap([])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domain/analise/__tests__/gap.test.ts`
Expected: FAIL — `Failed to resolve import "../gap"`.

- [ ] **Step 3: Write minimal implementation**

Create `src/domain/analise/gap.ts`:

```ts
export type ItemPedidoGap = { quantidadePedida: number; valorUnitario: number };
export type ItemFaturadoGap = { quantidadeFaturada: number; valorUnitario: number };

export type PedidoParaGap = {
  fabrica: string;
  cliente: string;
  criadoEm: Date;
  itens: ItemPedidoGap[];
  itensFaturados: ItemFaturadoGap[];
};

export type LinhaGap = {
  mes: string; // "AAAA-MM"
  fabrica: string;
  cliente: string;
  valorPedido: number;
  valorFaturado: number;
  gap: number;
};

function chaveMes(data: Date): string {
  const ano = data.getUTCFullYear();
  const mes = String(data.getUTCMonth() + 1).padStart(2, "0");
  return `${ano}-${mes}`;
}

// ADR-007: gap compara valor de PRODUTOS do pedido × valor de PRODUTOS faturado
// (valorUnitario é preço de produto, sem frete/imposto). Item a item, para atribuir
// corretamente quando uma NFe cobre vários pedidos (RN10).
export function calcularGap(pedidos: PedidoParaGap[]): LinhaGap[] {
  const grupos = new Map<string, LinhaGap>();

  for (const pedido of pedidos) {
    const mes = chaveMes(pedido.criadoEm);
    const chave = `${mes}|${pedido.fabrica}|${pedido.cliente}`;

    const valorPedido = pedido.itens.reduce((soma, i) => soma + i.quantidadePedida * i.valorUnitario, 0);
    const valorFaturado = pedido.itensFaturados.reduce((soma, f) => soma + f.quantidadeFaturada * f.valorUnitario, 0);

    if (!grupos.has(chave)) {
      grupos.set(chave, { mes, fabrica: pedido.fabrica, cliente: pedido.cliente, valorPedido: 0, valorFaturado: 0, gap: 0 });
    }
    const linha = grupos.get(chave)!;
    linha.valorPedido += valorPedido;
    linha.valorFaturado += valorFaturado;
    linha.gap = linha.valorPedido - linha.valorFaturado;
  }

  return [...grupos.values()].sort((a, b) => {
    if (a.mes !== b.mes) return b.mes.localeCompare(a.mes); // mês desc
    if (a.fabrica !== b.fabrica) return a.fabrica.localeCompare(b.fabrica);
    return a.cliente.localeCompare(b.cliente);
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/domain/analise/__tests__/gap.test.ts`
Expected: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
git add src/domain/analise/gap.ts src/domain/analise/__tests__/gap.test.ts
git commit -m "feat: cálculo do gap PEDIDOS×NFE (só produtos, ADR-007)"
```

---

## Task 2: Regra de alerta "pedido sem NFe" (domínio puro, ADR-006)

**Files:**
- Create: `src/domain/alerta/semNfe.ts`
- Test: `src/domain/alerta/__tests__/semNfe.test.ts`

**Interfaces:**
- Consumes: nada (função pura).
- Produces:
  - `type PedidoParaAlerta = { id: string; numero: string; fabrica: string; cliente: string; estado: string; criadoEm: Date }`
  - `type AlertaSemNfe = { pedidoId: string; numero: string; fabrica: string; cliente: string; diasSemNfe: number }`
  - `function pedidosSemNfeVencidos(pedidos: PedidoParaAlerta[], hoje: Date, prazoDias?: number): AlertaSemNfe[]`

- [ ] **Step 1: Write the failing test**

Create `src/domain/alerta/__tests__/semNfe.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { pedidosSemNfeVencidos, type PedidoParaAlerta } from "../semNfe";

const base: Omit<PedidoParaAlerta, "estado" | "criadoEm"> = {
  id: "p1",
  numero: "PED-1",
  fabrica: "Bowden",
  cliente: "Cliente A",
};

describe("pedidosSemNfeVencidos (RF34, ADR-006)", () => {
  const hoje = new Date("2026-07-16T12:00:00Z");

  it("sinaliza pedido SEM_NFE parado há mais do que o prazo (padrão 7 dias)", () => {
    const pedidos: PedidoParaAlerta[] = [
      { ...base, estado: "SEM_NFE", criadoEm: new Date("2026-07-01T12:00:00Z") }, // 15 dias
    ];
    expect(pedidosSemNfeVencidos(pedidos, hoje)).toEqual([
      { pedidoId: "p1", numero: "PED-1", fabrica: "Bowden", cliente: "Cliente A", diasSemNfe: 15 },
    ]);
  });

  it("ignora pedido SEM_NFE ainda dentro do prazo", () => {
    const pedidos: PedidoParaAlerta[] = [
      { ...base, estado: "SEM_NFE", criadoEm: new Date("2026-07-12T12:00:00Z") }, // 4 dias
    ];
    expect(pedidosSemNfeVencidos(pedidos, hoje)).toEqual([]);
  });

  it("ignora pedido que já tem nota (estado diferente de SEM_NFE)", () => {
    const pedidos: PedidoParaAlerta[] = [
      { ...base, estado: "PARCIAL", criadoEm: new Date("2026-06-01T12:00:00Z") },
      { ...base, id: "p2", estado: "COMPLETO", criadoEm: new Date("2026-06-01T12:00:00Z") },
    ];
    expect(pedidosSemNfeVencidos(pedidos, hoje)).toEqual([]);
  });

  it("respeita o prazo configurado", () => {
    const pedidos: PedidoParaAlerta[] = [
      { ...base, estado: "SEM_NFE", criadoEm: new Date("2026-07-06T12:00:00Z") }, // 10 dias
    ];
    expect(pedidosSemNfeVencidos(pedidos, hoje, 14)).toEqual([]);
    expect(pedidosSemNfeVencidos(pedidos, hoje, 10)).toHaveLength(1);
  });

  it("ordena do mais atrasado para o menos atrasado", () => {
    const pedidos: PedidoParaAlerta[] = [
      { ...base, id: "novo", estado: "SEM_NFE", criadoEm: new Date("2026-07-05T12:00:00Z") }, // 11
      { ...base, id: "velho", estado: "SEM_NFE", criadoEm: new Date("2026-06-01T12:00:00Z") }, // 45
    ];
    expect(pedidosSemNfeVencidos(pedidos, hoje).map((a) => a.pedidoId)).toEqual(["velho", "novo"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domain/alerta/__tests__/semNfe.test.ts`
Expected: FAIL — `Failed to resolve import "../semNfe"`.

- [ ] **Step 3: Write minimal implementation**

Create `src/domain/alerta/semNfe.ts`:

```ts
const MS_POR_DIA = 1000 * 60 * 60 * 24;

export type PedidoParaAlerta = {
  id: string;
  numero: string;
  fabrica: string;
  cliente: string;
  estado: string;
  criadoEm: Date;
};

export type AlertaSemNfe = {
  pedidoId: string;
  numero: string;
  fabrica: string;
  cliente: string;
  diasSemNfe: number;
};

// ADR-006: alerta de "pedido sem NFe" dispara após 7 dias (padrão único e global,
// configurável via Parametro "prazo_alerta_sem_nfe_dias"). Só pedidos em SEM_NFE —
// PARCIAL/COMPLETO já têm nota.
export function pedidosSemNfeVencidos(
  pedidos: PedidoParaAlerta[],
  hoje: Date,
  prazoDias: number = 7,
): AlertaSemNfe[] {
  return pedidos
    .filter((p) => p.estado === "SEM_NFE")
    .map((p) => ({
      pedido: p,
      diasSemNfe: Math.floor((hoje.getTime() - p.criadoEm.getTime()) / MS_POR_DIA),
    }))
    .filter(({ diasSemNfe }) => diasSemNfe >= prazoDias)
    .sort((a, b) => b.diasSemNfe - a.diasSemNfe)
    .map(({ pedido, diasSemNfe }) => ({
      pedidoId: pedido.id,
      numero: pedido.numero,
      fabrica: pedido.fabrica,
      cliente: pedido.cliente,
      diasSemNfe,
    }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/domain/alerta/__tests__/semNfe.test.ts`
Expected: PASS (5 testes).

- [ ] **Step 5: Commit**

```bash
git add src/domain/alerta/semNfe.ts src/domain/alerta/__tests__/semNfe.test.ts
git commit -m "feat: regra de alerta de pedido sem NFe (7 dias, ADR-006)"
```

---

## Task 3: Gerador de XLSX genérico (domínio puro, RF33)

**Files:**
- Create: `src/domain/export/xlsx.ts`
- Test: `src/domain/export/__tests__/xlsx.test.ts`

**Interfaces:**
- Consumes: `ExcelJS` (dependência existente).
- Produces:
  - `type CelulaXlsx = string | number`
  - `function gerarXlsx(nomePlanilha: string, cabecalhos: string[], linhas: CelulaXlsx[][]): Promise<Buffer>`

- [ ] **Step 1: Write the failing test**

Create `src/domain/export/__tests__/xlsx.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import { gerarXlsx } from "../xlsx";

describe("gerarXlsx (RF33)", () => {
  it("gera uma planilha com o nome, o cabeçalho e as linhas informadas", async () => {
    const buffer = await gerarXlsx(
      "Pedidos",
      ["Número", "Valor"],
      [
        ["PED-1", 100],
        ["PED-2", 250],
      ],
    );

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    const ws = wb.worksheets[0];

    expect(ws.name).toBe("Pedidos");
    expect(ws.getRow(1).getCell(1).value).toBe("Número");
    expect(ws.getRow(1).getCell(2).value).toBe("Valor");
    expect(ws.getRow(2).getCell(1).value).toBe("PED-1");
    expect(ws.getRow(2).getCell(2).value).toBe(100);
    expect(ws.getRow(3).getCell(1).value).toBe("PED-2");
    expect(ws.getRow(3).getCell(2).value).toBe(250);
  });

  it("gera só o cabeçalho quando não há linhas", async () => {
    const buffer = await gerarXlsx("Vazio", ["A", "B"], []);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    const ws = wb.worksheets[0];
    expect(ws.getRow(1).getCell(1).value).toBe("A");
    expect(ws.actualRowCount).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domain/export/__tests__/xlsx.test.ts`
Expected: FAIL — `Failed to resolve import "../xlsx"`.

- [ ] **Step 3: Write minimal implementation**

Create `src/domain/export/xlsx.ts`:

```ts
import ExcelJS from "exceljs";

export type CelulaXlsx = string | number;

// RF33: gera um XLSX de qualquer listagem (cabeçalhos + linhas). O chamador decide as
// colunas; esta função só monta a planilha e devolve os bytes.
export async function gerarXlsx(
  nomePlanilha: string,
  cabecalhos: string[],
  linhas: CelulaXlsx[][],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const planilha = workbook.addWorksheet(nomePlanilha);

  planilha.addRow(cabecalhos);
  planilha.getRow(1).font = { bold: true };

  for (const linha of linhas) {
    planilha.addRow(linha);
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer as ArrayBuffer);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/domain/export/__tests__/xlsx.test.ts`
Expected: PASS (2 testes).

- [ ] **Step 5: Commit**

```bash
git add src/domain/export/xlsx.ts src/domain/export/__tests__/xlsx.test.ts
git commit -m "feat: gerador de XLSX genérico para exportação de listas (RF33)"
```

---

## Task 4: Painel PEDIDOS×NFE (RF31)

**Files:**
- Create: `src/app/(app)/pedidos-x-nfe/queries.ts`
- Create: `src/app/(app)/pedidos-x-nfe/pedidos-x-nfe-tabela.tsx`
- Create: `src/app/(app)/pedidos-x-nfe/pedidos-x-nfe-filtros.tsx`
- Create: `src/app/(app)/pedidos-x-nfe/page.tsx`
- Modify: `e2e/smoke.spec.ts`

**Interfaces:**
- Consumes: `calcularGap`, `PedidoParaGap`, `LinhaGap` de `@/domain/analise/gap` (Task 1); `filtroFabricasPermitidas` de `@/lib/authz`; `obterUsuarioLogado`/`UsuarioSessao` de `@/lib/sessao`; `DataTable` de `@/components/patterns/data-table`; `PageContainer`/`PageHeader`; `Button`/`Select`.
- Produces:
  - `async function buscarPedidosParaGap(usuario: UsuarioSessao): Promise<PedidoParaGap[]>`
  - `type LinhaGapView` (linha serializável para a tabela client)
  - Route de export consumirá `buscarPedidosParaGap` + `calcularGap` na Task 5.

### Parte A — Query

- [ ] **Step 1: Create the queries file**

Create `src/app/(app)/pedidos-x-nfe/queries.ts`:

```ts
import { prisma } from "@/lib/prisma";
import type { UsuarioSessao } from "@/lib/sessao";
import { filtroFabricasPermitidas } from "@/lib/authz";
import type { PedidoParaGap } from "@/domain/analise/gap";

export async function buscarPedidosParaGap(usuario: UsuarioSessao): Promise<PedidoParaGap[]> {
  const fabricasPermitidas = filtroFabricasPermitidas(usuario);

  const pedidos = await prisma.pedido.findMany({
    where: fabricasPermitidas ? { fabricaId: { in: fabricasPermitidas } } : {},
    include: {
      fabrica: true,
      cliente: true,
      itens: { include: { itensFaturados: true } },
    },
  });

  return pedidos.map((pedido) => ({
    fabrica: pedido.fabrica.nome,
    cliente: pedido.cliente.nomeFantasia,
    criadoEm: pedido.criadoEm,
    itens: pedido.itens.map((item) => ({
      quantidadePedida: item.quantidadePedida,
      valorUnitario: Number(item.valorUnitario),
    })),
    itensFaturados: pedido.itens.flatMap((item) =>
      item.itensFaturados.map((faturado) => ({
        quantidadeFaturada: faturado.quantidadeFaturada,
        valorUnitario: Number(item.valorUnitario),
      })),
    ),
  }));
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no errors (a página que a usa ainda não existe; a query compila sozinha).

### Parte B — Tabela (client)

- [ ] **Step 3: Create the table component**

Create `src/app/(app)/pedidos-x-nfe/pedidos-x-nfe-tabela.tsx`:

```tsx
"use client";

import { DataTable } from "@/components/patterns/data-table";
import { cx } from "@/utils/cx";

export interface LinhaGapView {
  id: string;
  mes: string;
  fabrica: string;
  cliente: string;
  valorPedido: string;
  valorFaturado: string;
  gap: number;
  gapFmt: string;
}

export function PedidosXNfeTabela({ linhas }: { linhas: LinhaGapView[] }) {
  return (
    <DataTable<LinhaGapView>
      ariaLabel="Gap de faturamento por mês, fábrica e cliente"
      data={linhas}
      getRowId={(l) => l.id}
      vazio="Nenhum pedido no filtro selecionado."
      columns={[
        { id: "mes", header: "Mês", isRowHeader: true, render: (l) => <span className="font-medium text-primary">{l.mes}</span> },
        { id: "fabrica", header: "Fábrica", render: (l) => l.fabrica },
        { id: "cliente", header: "Cliente", render: (l) => l.cliente },
        { id: "pedido", header: "Valor pedido", render: (l) => l.valorPedido },
        { id: "faturado", header: "Valor faturado", render: (l) => l.valorFaturado },
        {
          id: "gap",
          header: "Gap",
          render: (l) => <span className={cx("font-medium", l.gap > 0 ? "text-error-primary" : "text-primary")}>{l.gapFmt}</span>,
        },
      ]}
    />
  );
}
```

### Parte C — Filtros (client, form GET)

- [ ] **Step 4: Create the filters component**

Create `src/app/(app)/pedidos-x-nfe/pedidos-x-nfe-filtros.tsx`:

```tsx
"use client";

import { Select } from "@/components/ui/select/select";
import { Button } from "@/components/ui/buttons/button";

type Opcao = { id: string; label: string };

export function PedidosXNfeFiltros({
  fabricas,
  clientes,
  meses,
  selecionado,
}: {
  fabricas: Opcao[];
  clientes: Opcao[];
  meses: Opcao[];
  selecionado: { fabrica?: string; cliente?: string; mes?: string };
}) {
  const TODOS: Opcao = { id: "", label: "Todos" };

  return (
    <form method="get" className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      <Select name="fabrica" label="Fábrica" defaultSelectedKey={selecionado.fabrica ?? ""} className="sm:w-52" items={[TODOS, ...fabricas]}>
        {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
      </Select>
      <Select name="cliente" label="Cliente" defaultSelectedKey={selecionado.cliente ?? ""} className="sm:w-52" items={[TODOS, ...clientes]}>
        {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
      </Select>
      <Select name="mes" label="Mês" defaultSelectedKey={selecionado.mes ?? ""} className="sm:w-40" items={[TODOS, ...meses]}>
        {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
      </Select>
      <Button type="submit" color="secondary">Filtrar</Button>
    </form>
  );
}
```

> A `Select` do Untitled (React Aria) renderiza um `<select>` oculto com o `name`, então o `<form method="get">` serializa os valores na querystring sem JavaScript próprio — o mesmo mecanismo de `name`/valor já usado nos forms com server action (ver `chamado-form.tsx`). A opção "Todos" tem `id: ""` (valor vazio): a página trata valor vazio como "sem filtro" (`!fabrica`), então selecionar "Todos" limpa o filtro daquela dimensão.

### Parte D — Página

- [ ] **Step 5: Create the page**

Create `src/app/(app)/pedidos-x-nfe/page.tsx`:

```tsx
import { Download01 } from "@untitledui/icons";
import { obterUsuarioLogado } from "@/lib/sessao";
import { buscarPedidosParaGap } from "./queries";
import { calcularGap, type LinhaGap } from "@/domain/analise/gap";
import { PageContainer } from "@/components/layouts/page-container";
import { PageHeader } from "@/components/patterns/page-header";
import { Button } from "@/components/ui/buttons/button";
import { PedidosXNfeFiltros } from "./pedidos-x-nfe-filtros";
import { PedidosXNfeTabela, type LinhaGapView } from "./pedidos-x-nfe-tabela";

const brl = (valor: number) => valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function opcoesUnicas(valores: string[]): { id: string; label: string }[] {
  return [...new Set(valores)].sort().map((v) => ({ id: v, label: v }));
}

export default async function PedidosXNfePage({
  searchParams,
}: {
  searchParams: Promise<{ fabrica?: string; cliente?: string; mes?: string }>;
}) {
  const { fabrica, cliente, mes } = await searchParams;

  const usuario = await obterUsuarioLogado();
  if (!usuario) {
    return (
      <PageContainer>
        <p className="text-sm text-error-primary">Sessão expirada. Faça login novamente.</p>
      </PageContainer>
    );
  }

  const pedidos = await buscarPedidosParaGap(usuario);
  const todasLinhas: LinhaGap[] = calcularGap(pedidos);

  const linhasFiltradas = todasLinhas.filter(
    (l) => (!fabrica || l.fabrica === fabrica) && (!cliente || l.cliente === cliente) && (!mes || l.mes === mes),
  );

  const linhasView: LinhaGapView[] = linhasFiltradas.map((l, i) => ({
    id: `${l.mes}-${l.fabrica}-${l.cliente}-${i}`,
    mes: l.mes,
    fabrica: l.fabrica,
    cliente: l.cliente,
    valorPedido: brl(l.valorPedido),
    valorFaturado: brl(l.valorFaturado),
    gap: l.gap,
    gapFmt: brl(l.gap),
  }));

  // Resumo mensal (gap total por mês) para o gráfico de barras em CSS.
  const gapPorMes = new Map<string, number>();
  for (const l of linhasFiltradas) gapPorMes.set(l.mes, (gapPorMes.get(l.mes) ?? 0) + l.gap);
  const resumo = [...gapPorMes.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  const gapMax = Math.max(1, ...resumo.map(([, total]) => total));

  const qs = new URLSearchParams();
  if (fabrica) qs.set("fabrica", fabrica);
  if (cliente) qs.set("cliente", cliente);
  if (mes) qs.set("mes", mes);

  return (
    <PageContainer>
      <PageHeader
        titulo="Pedidos × NFe"
        descricao="Gap de faturamento (valor de produtos) por mês, fábrica e cliente."
        acoes={
          <Button color="secondary" href={`/api/export/pedidos-x-nfe?${qs.toString()}`} iconLeading={Download01}>
            Exportar XLSX
          </Button>
        }
      />

      <PedidosXNfeFiltros
        fabricas={opcoesUnicas(todasLinhas.map((l) => l.fabrica))}
        clientes={opcoesUnicas(todasLinhas.map((l) => l.cliente))}
        meses={opcoesUnicas(todasLinhas.map((l) => l.mes))}
        selecionado={{ fabrica, cliente, mes }}
      />

      {resumo.length > 0 && (
        <div className="flex flex-col gap-3 rounded-xl bg-primary p-6 ring-1 ring-secondary">
          <h2 className="text-lg font-semibold text-primary">Gap total por mês</h2>
          <ul className="flex flex-col gap-2">
            {resumo.map(([mesLabel, total]) => (
              <li key={mesLabel} className="flex items-center gap-3">
                <span className="w-20 shrink-0 text-sm text-tertiary">{mesLabel}</span>
                <span className="h-3 rounded-full bg-fg-error-primary" style={{ width: `${Math.max(2, (total / gapMax) * 100)}%` }} aria-hidden />
                <span className="text-sm font-medium text-primary">{brl(total)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <PedidosXNfeTabela linhas={linhasView} />
    </PageContainer>
  );
}
```

- [ ] **Step 6: Add the e2e smoke redirect**

Em `e2e/smoke.spec.ts`, adicione ao final do arquivo:

```ts
test("visitante não logado é redirecionado de /pedidos-x-nfe", async ({ page }) => {
  await page.goto("/pedidos-x-nfe");
  await expect(page).toHaveURL(/\/login/);
});
```

- [ ] **Step 7: Verify build and types**

Run: `npx tsc --noEmit && npm run build`
Expected: build verde (a rota `/api/export/pedidos-x-nfe` referenciada pelo botão ainda não existe, mas é um `href` string — não quebra o build; será criada na Task 5).

- [ ] **Step 8: Commit**

```bash
git add src/app/\(app\)/pedidos-x-nfe e2e/smoke.spec.ts
git commit -m "feat: painel PEDIDOS×NFE com gap, filtros e resumo mensal (RF31)"
```

---

## Task 5: Exportação XLSX das listas (RF33)

**Files:**
- Create: `src/app/api/export/pedidos-x-nfe/route.ts`
- Create: `src/app/api/export/pedidos/route.ts`
- Create: `src/app/api/export/divergencias/route.ts`
- Modify: `src/app/(app)/pedidos/page.tsx`
- Modify: `src/app/(app)/divergencias/page.tsx`

**Interfaces:**
- Consumes: `gerarXlsx` de `@/domain/export/xlsx` (Task 3); `calcularGap` + `buscarPedidosParaGap` (Tasks 1/4); `buscarPedidosPermitidos` de `@/app/(app)/pedidos/queries`; `filtrarPedidos`/`FiltroPedido` de `@/domain/pedido/filtro`; `buscarChamadosPermitidos` de `@/app/(app)/divergencias/queries`; `obterUsuarioLogado` de `@/lib/sessao`.
- Produces: três route handlers `GET` que devolvem `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.

### Parte A — Route do painel PEDIDOS×NFE

- [ ] **Step 1: Create the pedidos-x-nfe export route**

Create `src/app/api/export/pedidos-x-nfe/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { obterUsuarioLogado } from "@/lib/sessao";
import { buscarPedidosParaGap } from "@/app/(app)/pedidos-x-nfe/queries";
import { calcularGap } from "@/domain/analise/gap";
import { gerarXlsx } from "@/domain/export/xlsx";

const CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export async function GET(request: NextRequest) {
  const usuario = await obterUsuarioLogado();
  if (!usuario) return NextResponse.json({ erro: "não autenticado" }, { status: 401 });

  const fabrica = request.nextUrl.searchParams.get("fabrica") ?? "";
  const cliente = request.nextUrl.searchParams.get("cliente") ?? "";
  const mes = request.nextUrl.searchParams.get("mes") ?? "";

  const linhas = calcularGap(await buscarPedidosParaGap(usuario)).filter(
    (l) => (!fabrica || l.fabrica === fabrica) && (!cliente || l.cliente === cliente) && (!mes || l.mes === mes),
  );

  const buffer = await gerarXlsx(
    "Pedidos x NFe",
    ["Mês", "Fábrica", "Cliente", "Valor pedido", "Valor faturado", "Gap"],
    linhas.map((l) => [l.mes, l.fabrica, l.cliente, l.valorPedido, l.valorFaturado, l.gap]),
  );

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": CONTENT_TYPE,
      "Content-Disposition": 'attachment; filename="pedidos-x-nfe.xlsx"',
    },
  });
}
```

- [ ] **Step 2: Create the pedidos export route**

Create `src/app/api/export/pedidos/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { obterUsuarioLogado } from "@/lib/sessao";
import { buscarPedidosPermitidos } from "@/app/(app)/pedidos/queries";
import { filtrarPedidos, type FiltroPedido } from "@/domain/pedido/filtro";
import { gerarXlsx } from "@/domain/export/xlsx";

const CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const FILTROS_VALIDOS: FiltroPedido[] = ["EM_ANDAMENTO", "CONCLUIDOS", "ARQUIVADOS", "TODOS"];

export async function GET(request: NextRequest) {
  const usuario = await obterUsuarioLogado();
  if (!usuario) return NextResponse.json({ erro: "não autenticado" }, { status: 401 });

  const filtroBruto = request.nextUrl.searchParams.get("filtro");
  const filtro: FiltroPedido =
    filtroBruto && (FILTROS_VALIDOS as string[]).includes(filtroBruto) ? (filtroBruto as FiltroPedido) : "TODOS";

  const pedidos = filtrarPedidos(await buscarPedidosPermitidos(usuario), filtro);

  const buffer = await gerarXlsx(
    "Pedidos",
    ["Número", "Fábrica", "Cliente", "Itens", "Estado"],
    pedidos.map((p) => [
      p.semNumero ? "S/N" : (p.numero ?? "—"),
      p.fabrica.nome,
      p.cliente.nomeFantasia,
      p.itens.length,
      p.estado,
    ]),
  );

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": CONTENT_TYPE,
      "Content-Disposition": 'attachment; filename="pedidos.xlsx"',
    },
  });
}
```

- [ ] **Step 3: Create the divergencias export route**

Create `src/app/api/export/divergencias/route.ts`:

```ts
import { NextResponse } from "next/server";
import { obterUsuarioLogado } from "@/lib/sessao";
import { buscarChamadosPermitidos } from "@/app/(app)/divergencias/queries";
import { gerarXlsx } from "@/domain/export/xlsx";

const CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export async function GET() {
  const usuario = await obterUsuarioLogado();
  if (!usuario) return NextResponse.json({ erro: "não autenticado" }, { status: 401 });

  const chamados = await buscarChamadosPermitidos(usuario);

  const buffer = await gerarXlsx(
    "Divergências",
    ["NFe", "Motivo", "Estado", "Crítico"],
    chamados.map((c) => [c.notaFiscal.numero, c.motivo.nome, c.estado, c.critico ? "Sim" : "Não"]),
  );

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": CONTENT_TYPE,
      "Content-Disposition": 'attachment; filename="divergencias.xlsx"',
    },
  });
}
```

### Parte B — Botões de export nas listas

- [ ] **Step 4: Add the export button to the pedidos list**

Em `src/app/(app)/pedidos/page.tsx`, troque o import de ícones:

```tsx
import { Download01, Plus, Upload01 } from "@untitledui/icons";
```

E, dentro do `PageHeader`, adicione o botão de export como primeira ação (antes do "Importar Excel"), passando o filtro atual:

```tsx
        acoes={
          <>
            <Button color="secondary" href={`/api/export/pedidos?filtro=${filtro}`} iconLeading={Download01}>
              Exportar XLSX
            </Button>
            <Button color="secondary" href="/pedidos/importar" iconLeading={Upload01}>
              Importar Excel
            </Button>
            <Button color="primary" href="/pedidos/novo" iconLeading={Plus}>
              Novo pedido
            </Button>
          </>
        }
```

- [ ] **Step 5: Add the export button to the divergencias list**

Em `src/app/(app)/divergencias/page.tsx`, adicione os imports do ícone e do Button no topo:

```tsx
import { Download01 } from "@untitledui/icons";
import { Button } from "@/components/ui/buttons/button";
```

E troque o `PageHeader` (que hoje não tem `acoes`) por:

```tsx
      <PageHeader
        titulo="Divergências"
        descricao="Chamados abertos a partir de notas fiscais."
        acoes={
          <Button color="secondary" href="/api/export/divergencias" iconLeading={Download01}>
            Exportar XLSX
          </Button>
        }
      />
```

- [ ] **Step 6: Verify build and types**

Run: `npx tsc --noEmit && npm run build`
Expected: build verde; as três rotas `/api/export/*` aparecem na saída do build.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/export src/app/\(app\)/pedidos/page.tsx src/app/\(app\)/divergencias/page.tsx
git commit -m "feat: exportação XLSX do painel, pedidos e divergências (RF33)"
```

---

## Task 6: Central de alertas — pedido sem NFe (RF34)

**Files:**
- Create: `src/app/(app)/alertas/queries.ts`
- Create: `src/app/(app)/alertas/alertas-tabela.tsx`
- Create: `src/app/(app)/alertas/page.tsx`
- Modify: `e2e/smoke.spec.ts`

**Interfaces:**
- Consumes: `pedidosSemNfeVencidos`, `PedidoParaAlerta` de `@/domain/alerta/semNfe` (Task 2); `obterParametroNumero` de `@/lib/parametros`; `filtroFabricasPermitidas` de `@/lib/authz`; `obterUsuarioLogado`/`UsuarioSessao`; `DataTable`.
- Produces:
  - `async function buscarPedidosParaAlerta(usuario: UsuarioSessao): Promise<PedidoParaAlerta[]>` (reutilizada pelo dashboard na Task 7)

### Parte A — Query

- [ ] **Step 1: Create the queries file**

Create `src/app/(app)/alertas/queries.ts`:

```ts
import { prisma } from "@/lib/prisma";
import type { UsuarioSessao } from "@/lib/sessao";
import { filtroFabricasPermitidas } from "@/lib/authz";
import type { PedidoParaAlerta } from "@/domain/alerta/semNfe";

export async function buscarPedidosParaAlerta(usuario: UsuarioSessao): Promise<PedidoParaAlerta[]> {
  const fabricasPermitidas = filtroFabricasPermitidas(usuario);

  const pedidos = await prisma.pedido.findMany({
    where: fabricasPermitidas ? { fabricaId: { in: fabricasPermitidas } } : {},
    include: { fabrica: true, cliente: true },
    orderBy: { criadoEm: "desc" },
  });

  return pedidos.map((pedido) => ({
    id: pedido.id,
    numero: pedido.semNumero ? "S/N" : (pedido.numero ?? "—"),
    fabrica: pedido.fabrica.nome,
    cliente: pedido.cliente.nomeFantasia,
    estado: pedido.estado,
    criadoEm: pedido.criadoEm,
  }));
}
```

### Parte B — Tabela (client)

- [ ] **Step 2: Create the table component**

Create `src/app/(app)/alertas/alertas-tabela.tsx`:

```tsx
"use client";

import { DataTable } from "@/components/patterns/data-table";

export interface AlertaLinha {
  id: string;
  numero: string;
  fabrica: string;
  cliente: string;
  diasSemNfe: number;
}

export function AlertasTabela({ alertas }: { alertas: AlertaLinha[] }) {
  return (
    <DataTable<AlertaLinha>
      ariaLabel="Pedidos sem NFe vencidos"
      data={alertas}
      getRowId={(a) => a.id}
      rowHref={(a) => `/pedidos/${a.id}`}
      vazio="Nenhum pedido sem NFe fora do prazo. 🎉"
      columns={[
        { id: "numero", header: "Pedido", isRowHeader: true, render: (a) => <span className="font-medium text-primary">{a.numero}</span> },
        { id: "fabrica", header: "Fábrica", render: (a) => a.fabrica },
        { id: "cliente", header: "Cliente", render: (a) => a.cliente },
        { id: "dias", header: "Dias sem NFe", render: (a) => <span className="font-medium text-error-primary">{a.diasSemNfe}</span> },
      ]}
    />
  );
}
```

### Parte C — Página

- [ ] **Step 3: Create the page**

Create `src/app/(app)/alertas/page.tsx`:

```tsx
import { obterUsuarioLogado } from "@/lib/sessao";
import { buscarPedidosParaAlerta } from "./queries";
import { pedidosSemNfeVencidos } from "@/domain/alerta/semNfe";
import { obterParametroNumero } from "@/lib/parametros";
import { PageContainer } from "@/components/layouts/page-container";
import { PageHeader } from "@/components/patterns/page-header";
import { AlertasTabela, type AlertaLinha } from "./alertas-tabela";

export default async function AlertasPage() {
  const usuario = await obterUsuarioLogado();
  if (!usuario) {
    return (
      <PageContainer>
        <p className="text-sm text-error-primary">Sessão expirada. Faça login novamente.</p>
      </PageContainer>
    );
  }

  const prazoDias = await obterParametroNumero("prazo_alerta_sem_nfe_dias", 7);
  const pedidos = await buscarPedidosParaAlerta(usuario);
  const vencidos = pedidosSemNfeVencidos(pedidos, new Date(), prazoDias);

  const linhas: AlertaLinha[] = vencidos.map((a) => ({
    id: a.pedidoId,
    numero: a.numero,
    fabrica: a.fabrica,
    cliente: a.cliente,
    diasSemNfe: a.diasSemNfe,
  }));

  return (
    <PageContainer>
      <PageHeader titulo="Alertas" descricao={`Pedidos sem nota fiscal há mais de ${prazoDias} dias.`} />
      <AlertasTabela alertas={linhas} />
    </PageContainer>
  );
}
```

- [ ] **Step 4: Add the e2e smoke redirect**

Em `e2e/smoke.spec.ts`, adicione ao final do arquivo:

```ts
test("visitante não logado é redirecionado de /alertas", async ({ page }) => {
  await page.goto("/alertas");
  await expect(page).toHaveURL(/\/login/);
});
```

- [ ] **Step 5: Verify build and types**

Run: `npx tsc --noEmit && npm run build`
Expected: build verde, rota `/alertas` presente.

- [ ] **Step 6: Commit**

```bash
git add src/app/\(app\)/alertas e2e/smoke.spec.ts
git commit -m "feat: central de alertas de pedido sem NFe (RF34)"
```

---

## Task 7: Dashboard com KPIs reais + fila do dia

**Files:**
- Create: `src/app/(app)/queries.ts`
- Modify: `src/app/(app)/page.tsx`

**Interfaces:**
- Consumes: `buscarPedidosParaAlerta` de `@/app/(app)/alertas/queries` (Task 6); `pedidosSemNfeVencidos` (Task 2); `buscarChamadosPermitidos` de `@/app/(app)/divergencias/queries` (Épico 6, já calcula `critico`); `obterParametroNumero`; `filtroFabricasPermitidas`; `obterUsuarioLogado`/`UsuarioSessao`.
- Produces:
  - `type ItemFila = { tipo: "SEM_NFE" | "CRITICO"; titulo: string; detalhe: string; href: string; ordem: number }`
  - `type ResumoDashboard = { kpis: { pedidosAtivos: number; nfesTransito: number; divergenciasAbertas: number; alertas: number }; fila: ItemFila[] }`
  - `async function buscarResumoDashboard(usuario: UsuarioSessao): Promise<ResumoDashboard>`

### Parte A — Query

- [ ] **Step 1: Create the dashboard queries file**

Create `src/app/(app)/queries.ts`:

```ts
import { prisma } from "@/lib/prisma";
import type { UsuarioSessao } from "@/lib/sessao";
import { filtroFabricasPermitidas } from "@/lib/authz";
import { obterParametroNumero } from "@/lib/parametros";
import { buscarPedidosParaAlerta } from "./alertas/queries";
import { pedidosSemNfeVencidos } from "@/domain/alerta/semNfe";
import { buscarChamadosPermitidos } from "./divergencias/queries";

export type ItemFila = {
  tipo: "SEM_NFE" | "CRITICO";
  titulo: string;
  detalhe: string;
  href: string;
  ordem: number; // dias de atraso — maior = mais urgente
};

export type ResumoDashboard = {
  kpis: { pedidosAtivos: number; nfesTransito: number; divergenciasAbertas: number; alertas: number };
  fila: ItemFila[];
};

export async function buscarResumoDashboard(usuario: UsuarioSessao): Promise<ResumoDashboard> {
  const fabricasPermitidas = filtroFabricasPermitidas(usuario);
  const wherePedidoFabrica = fabricasPermitidas ? { fabricaId: { in: fabricasPermitidas } } : {};
  const whereNotaFabrica = fabricasPermitidas
    ? { pedidos: { some: { pedido: { fabricaId: { in: fabricasPermitidas } } } } }
    : {};

  const pedidosAtivos = await prisma.pedido.count({
    where: { ...wherePedidoFabrica, estado: { in: ["SEM_NFE", "PARCIAL"] } },
  });
  const nfesTransito = await prisma.notaFiscal.count({
    where: { status: "TRANSITO", ...whereNotaFabrica },
  });

  const prazoDias = await obterParametroNumero("prazo_alerta_sem_nfe_dias", 7);
  const vencidos = pedidosSemNfeVencidos(await buscarPedidosParaAlerta(usuario), new Date(), prazoDias);

  const chamados = await buscarChamadosPermitidos(usuario);
  const abertos = chamados.filter((c) => c.estado !== "RESOLVIDO");
  const criticos = abertos.filter((c) => c.critico);

  const fila: ItemFila[] = [
    ...vencidos.map((a) => ({
      tipo: "SEM_NFE" as const,
      titulo: `Pedido ${a.numero} sem NFe`,
      detalhe: `${a.fabrica} · ${a.cliente} · ${a.diasSemNfe} dias`,
      href: `/pedidos/${a.pedidoId}`,
      ordem: a.diasSemNfe,
    })),
    ...criticos.map((c) => ({
      tipo: "CRITICO" as const,
      titulo: `Chamado crítico — NFe ${c.notaFiscal.numero}`,
      detalhe: `${c.motivo.nome} · ${c.estado}`,
      href: `/divergencias/${c.id}`,
      ordem: 30, // críticos são urgentes; ficam próximos do topo
    })),
  ].sort((a, b) => b.ordem - a.ordem);

  return {
    kpis: { pedidosAtivos, nfesTransito, divergenciasAbertas: abertos.length, alertas: vencidos.length },
    fila,
  };
}
```

### Parte B — Página

- [ ] **Step 2: Rewrite the dashboard page**

Replace the entire contents of `src/app/(app)/page.tsx` with:

```tsx
import Link from "next/link";
import { AlertTriangle, Bell01, Package, Truck01 } from "@untitledui/icons";
import { obterUsuarioLogado } from "@/lib/sessao";
import { buscarResumoDashboard } from "./queries";
import { PageContainer } from "@/components/layouts/page-container";
import { PageHeader } from "@/components/patterns/page-header";

const FILA_MAX = 8;

export default async function DashboardPage() {
  const usuario = await obterUsuarioLogado();
  if (!usuario) {
    return (
      <PageContainer>
        <p className="text-sm text-error-primary">Sessão expirada. Faça login novamente.</p>
      </PageContainer>
    );
  }

  const { kpis, fila } = await buscarResumoDashboard(usuario);

  const cartoes = [
    { rotulo: "Pedidos ativos", valor: kpis.pedidosAtivos, icone: Package, dica: "Ainda não arquivados", alerta: false },
    { rotulo: "NFes em trânsito", valor: kpis.nfesTransito, icone: Truck01, dica: "Aguardando recebimento", alerta: false },
    { rotulo: "Divergências abertas", valor: kpis.divergenciasAbertas, icone: AlertTriangle, dica: "Chamados sem resolução", alerta: kpis.divergenciasAbertas > 0 },
    { rotulo: "Alertas (sem NFe)", valor: kpis.alertas, icone: Bell01, dica: "Pedidos fora do prazo", alerta: kpis.alertas > 0 },
  ];

  const filaVisivel = fila.slice(0, FILA_MAX);

  return (
    <PageContainer>
      <PageHeader titulo="Dashboard" descricao="Visão geral da operação de representação comercial." />

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {cartoes.map((c) => {
          const Icone = c.icone;
          return (
            <div key={c.rotulo} className="flex flex-col gap-4 rounded-xl bg-primary p-5 ring-1 ring-secondary">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-tertiary">{c.rotulo}</span>
                <span className={c.alerta ? "text-fg-error-primary" : "text-fg-brand-primary"}>
                  <Icone className="size-5" />
                </span>
              </div>
              <p className="text-display-sm font-semibold text-primary">{c.valor}</p>
              <p className="text-xs text-quaternary">{c.dica}</p>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-4 rounded-xl bg-primary p-6 ring-1 ring-secondary">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-primary">Fila do dia</h2>
          <div className="flex gap-3 text-sm">
            <Link href="/alertas" className="text-brand-secondary hover:underline">Ver alertas</Link>
            <Link href="/divergencias" className="text-brand-secondary hover:underline">Ver divergências</Link>
          </div>
        </div>

        {filaVisivel.length === 0 ? (
          <p className="text-sm text-tertiary">Nada pendente. Tudo em dia. 🎉</p>
        ) : (
          <ul className="flex flex-col divide-y divide-secondary">
            {filaVisivel.map((item) => (
              <li key={`${item.tipo}-${item.href}`}>
                <Link href={item.href} className="flex items-center gap-3 py-3 hover:bg-primary_hover">
                  <span className={item.tipo === "CRITICO" ? "text-fg-error-primary" : "text-fg-brand-primary"}>
                    {item.tipo === "CRITICO" ? <AlertTriangle className="size-4" /> : <Bell01 className="size-4" />}
                  </span>
                  <span className="flex-1 text-sm font-medium text-primary">{item.titulo}</span>
                  <span className="text-xs text-tertiary">{item.detalhe}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {fila.length > FILA_MAX && (
          <p className="text-xs text-quaternary">Mostrando os {FILA_MAX} itens mais urgentes de {fila.length}.</p>
        )}
      </div>
    </PageContainer>
  );
}
```

- [ ] **Step 3: Verify build and types**

Run: `npx tsc --noEmit && npm run build`
Expected: build verde.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(app\)/queries.ts src/app/\(app\)/page.tsx
git commit -m "feat: dashboard com KPIs reais e fila do dia (sem NFe + críticos)"
```

---

## Task 8: Consulta de auditoria (RF32)

**Files:**
- Create: `src/app/(app)/auditoria/queries.ts`
- Create: `src/app/(app)/auditoria/auditoria-filtros.tsx`
- Create: `src/app/(app)/auditoria/auditoria-tabela.tsx`
- Create: `src/app/(app)/auditoria/page.tsx`
- Modify: `src/components/nav-itens.ts`
- Modify: `e2e/smoke.spec.ts`

**Interfaces:**
- Consumes: `prisma`; `obterUsuarioLogado`; `DataTable`; `Select`; `Button`; `Prisma` (tipo do where).
- Produces:
  - `type FiltroAuditoria = { de?: string; ate?: string; usuarioId?: string; entidade?: string }`
  - `async function buscarEventosAuditoria(filtro: FiltroAuditoria)`
  - `async function listarUsuariosParaFiltro()`
  - `async function listarEntidadesAuditadas(): Promise<string[]>`
  - `const AUDITORIA_LIMITE = 500`

### Parte A — Query

- [ ] **Step 1: Create the queries file**

Create `src/app/(app)/auditoria/queries.ts`:

```ts
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const AUDITORIA_LIMITE = 500;

export type FiltroAuditoria = {
  de?: string; // "AAAA-MM-DD"
  ate?: string; // "AAAA-MM-DD"
  usuarioId?: string;
  entidade?: string;
};

export async function buscarEventosAuditoria(filtro: FiltroAuditoria) {
  const where: Prisma.EventoAuditoriaWhereInput = {};

  if (filtro.usuarioId) where.usuarioId = filtro.usuarioId;
  if (filtro.entidade) where.entidade = filtro.entidade;

  if (filtro.de || filtro.ate) {
    const criadoEm: Prisma.DateTimeFilter = {};
    if (filtro.de) criadoEm.gte = new Date(`${filtro.de}T00:00:00`);
    if (filtro.ate) criadoEm.lte = new Date(`${filtro.ate}T23:59:59`);
    where.criadoEm = criadoEm;
  }

  return prisma.eventoAuditoria.findMany({
    where,
    include: { usuario: true },
    orderBy: { criadoEm: "desc" },
    take: AUDITORIA_LIMITE,
  });
}

export async function listarUsuariosParaFiltro() {
  return prisma.usuario.findMany({ orderBy: { nome: "asc" }, select: { id: true, nome: true } });
}

export async function listarEntidadesAuditadas(): Promise<string[]> {
  const linhas = await prisma.eventoAuditoria.findMany({
    distinct: ["entidade"],
    select: { entidade: true },
    orderBy: { entidade: "asc" },
  });
  return linhas.map((l) => l.entidade);
}
```

### Parte B — Filtros (client, form GET)

- [ ] **Step 2: Create the filters component**

Create `src/app/(app)/auditoria/auditoria-filtros.tsx`:

```tsx
"use client";

import { Select } from "@/components/ui/select/select";
import { Input } from "@/components/ui/input/input";
import { Button } from "@/components/ui/buttons/button";

type Opcao = { id: string; label: string };

export function AuditoriaFiltros({
  usuarios,
  entidades,
  selecionado,
}: {
  usuarios: Opcao[];
  entidades: Opcao[];
  selecionado: { de?: string; ate?: string; usuarioId?: string; entidade?: string };
}) {
  const TODOS: Opcao = { id: "", label: "Todos" };

  return (
    <form method="get" className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      <Input type="date" name="de" label="De" defaultValue={selecionado.de ?? ""} className="sm:w-44" />
      <Input type="date" name="ate" label="Até" defaultValue={selecionado.ate ?? ""} className="sm:w-44" />
      <Select name="usuarioId" label="Usuário" defaultSelectedKey={selecionado.usuarioId ?? ""} className="sm:w-52" items={[TODOS, ...usuarios]}>
        {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
      </Select>
      <Select name="entidade" label="Tipo de registro" defaultSelectedKey={selecionado.entidade ?? ""} className="sm:w-52" items={[TODOS, ...entidades]}>
        {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
      </Select>
      <Button type="submit" color="secondary">Filtrar</Button>
    </form>
  );
}
```

### Parte C — Tabela (client)

- [ ] **Step 3: Create the table component**

Create `src/app/(app)/auditoria/auditoria-tabela.tsx`:

```tsx
"use client";

import { DataTable } from "@/components/patterns/data-table";

export interface EventoAuditoriaLinha {
  id: string;
  quando: string;
  usuario: string;
  entidade: string;
  entidadeId: string;
  campo: string;
  de: string;
  para: string;
}

export function AuditoriaTabela({ eventos }: { eventos: EventoAuditoriaLinha[] }) {
  return (
    <DataTable<EventoAuditoriaLinha>
      ariaLabel="Eventos de auditoria"
      data={eventos}
      getRowId={(e) => e.id}
      vazio="Nenhum evento de auditoria no filtro selecionado."
      columns={[
        { id: "quando", header: "Quando", isRowHeader: true, render: (e) => <span className="text-xs text-tertiary">{e.quando}</span> },
        { id: "usuario", header: "Usuário", render: (e) => e.usuario },
        { id: "entidade", header: "Registro", render: (e) => <span>{e.entidade} <span className="text-xs text-quaternary">{e.entidadeId}</span></span> },
        { id: "campo", header: "Campo", render: (e) => e.campo },
        { id: "de", header: "De", render: (e) => <span className="text-tertiary">{e.de}</span> },
        { id: "para", header: "Para", render: (e) => <span className="font-medium text-primary">{e.para}</span> },
      ]}
    />
  );
}
```

### Parte D — Página

- [ ] **Step 4: Create the page**

Create `src/app/(app)/auditoria/page.tsx`:

```tsx
import { obterUsuarioLogado } from "@/lib/sessao";
import {
  buscarEventosAuditoria,
  listarUsuariosParaFiltro,
  listarEntidadesAuditadas,
  AUDITORIA_LIMITE,
} from "./queries";
import { PageContainer } from "@/components/layouts/page-container";
import { PageHeader } from "@/components/patterns/page-header";
import { AuditoriaFiltros } from "./auditoria-filtros";
import { AuditoriaTabela, type EventoAuditoriaLinha } from "./auditoria-tabela";

export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<{ de?: string; ate?: string; usuarioId?: string; entidade?: string }>;
}) {
  const { de, ate, usuarioId, entidade } = await searchParams;

  const usuario = await obterUsuarioLogado();
  if (!usuario) {
    return (
      <PageContainer>
        <p className="text-sm text-error-primary">Sessão expirada. Faça login novamente.</p>
      </PageContainer>
    );
  }

  const [eventos, usuarios, entidades] = await Promise.all([
    buscarEventosAuditoria({ de, ate, usuarioId, entidade }),
    listarUsuariosParaFiltro(),
    listarEntidadesAuditadas(),
  ]);

  const linhas: EventoAuditoriaLinha[] = eventos.map((e) => ({
    id: e.id,
    quando: new Date(e.criadoEm).toLocaleString("pt-BR"),
    usuario: e.usuario.nome,
    entidade: e.entidade,
    entidadeId: e.entidadeId,
    campo: e.campo,
    de: e.valorAnterior ?? "—",
    para: e.valorNovo ?? "—",
  }));

  return (
    <PageContainer>
      <PageHeader titulo="Auditoria" descricao="Histórico de alterações em pedidos e notas fiscais." />

      <AuditoriaFiltros
        usuarios={usuarios.map((u) => ({ id: u.id, label: u.nome }))}
        entidades={entidades.map((e) => ({ id: e, label: e }))}
        selecionado={{ de, ate, usuarioId, entidade }}
      />

      <AuditoriaTabela eventos={linhas} />

      {eventos.length === AUDITORIA_LIMITE && (
        <p className="text-xs text-quaternary">
          Mostrando os {AUDITORIA_LIMITE} eventos mais recentes. Refine o período ou os filtros para ver o restante.
        </p>
      )}
    </PageContainer>
  );
}
```

### Parte E — Navegação e smoke

- [ ] **Step 5: Add the nav item**

Em `src/components/nav-itens.ts`, adicione `FileSearch02` ao import de ícones e o item de menu de auditoria logo antes de "Cadastros":

```ts
import { AlertTriangle, BarChartSquare02, Bell01, FileCheck02, FileSearch02, Home01, Package, Settings01, Truck01 } from "@untitledui/icons";
import type { NavItemType } from "@/components/application/app-navigation/config";

export const ITENS_MENU: NavItemType[] = [
  { href: "/", label: "Dashboard", icon: Home01 },
  { href: "/pedidos", label: "Pedidos", icon: Package },
  { href: "/conferencia", label: "Conferência NFe", icon: FileCheck02 },
  { href: "/rastreio", label: "Rastreio", icon: Truck01 },
  { href: "/divergencias", label: "Divergências", icon: AlertTriangle },
  { href: "/pedidos-x-nfe", label: "Pedidos × NFe", icon: BarChartSquare02 },
  { href: "/alertas", label: "Alertas", icon: Bell01 },
  { href: "/auditoria", label: "Auditoria", icon: FileSearch02 },
  { href: "/cadastros", label: "Cadastros", icon: Settings01 },
];
```

> Se `FileSearch02` não existir no pacote `@untitledui/icons`, use `SearchLg` (que já é usado no projeto) como ícone do item de Auditoria.

- [ ] **Step 6: Add the e2e smoke redirect**

Em `e2e/smoke.spec.ts`, adicione ao final do arquivo:

```ts
test("visitante não logado é redirecionado de /auditoria", async ({ page }) => {
  await page.goto("/auditoria");
  await expect(page).toHaveURL(/\/login/);
});
```

- [ ] **Step 7: Verify build and types**

Run: `npx tsc --noEmit && npm run build`
Expected: build verde, rota `/auditoria` presente.

- [ ] **Step 8: Commit**

```bash
git add src/app/\(app\)/auditoria src/components/nav-itens.ts e2e/smoke.spec.ts
git commit -m "feat: consulta de auditoria por período, usuário e tipo de registro (RF32)"
```

---

## Encerramento do épico

- [ ] **Verificação final (neste ambiente):**

```bash
npx vitest run src/domain && npx tsc --noEmit && npm run build
```
Expected: domínio verde (gap, semNfe, xlsx + os já existentes), sem erros de tipo, build de produção verde com as rotas `/pedidos-x-nfe`, `/alertas`, `/auditoria` e `/api/export/*`.

- [ ] **Verificação em CI/staging (com `DATABASE_URL`):** `npm test` (integração) e `npm run e2e` (redirecionamentos, incluindo os três novos).

- [ ] **Atualizar `CLAUDE.md` §1:** registrar Épico 7 concluído e marcar o **MVP completo**.

- [ ] **`finishing-a-development-branch`** quando tudo estiver verde e revisado.
