# Histórico Mensal no Dashboard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Importar os totais mensais de pedidos recebidos e NFes emitidas das planilhas de controle históricas e exibi-los, junto com os dados operacionais ao vivo, num gráfico de evolução mensal no dashboard.

**Architecture:** Toda a regra (parsing de planilha, resolução de fábrica, cálculo dos totais ao vivo, mesclagem das séries) fica em funções puras sob `src/domain/`, sem importar Next/Prisma/Supabase — é onde o TDD acontece. Uma tabela nova `HistoricoMensal` guarda só o agregado (ano, mês, fábrica, tipo, valor), desacoplada de `Pedido`/`NotaFiscal`. Telas (`src/app/(app)/historico/importar/`, `src/app/(app)/page.tsx`) e queries (`src/app/(app)/queries.ts`) são finas e chamam o domínio.

**Tech Stack:** Next.js (App Router) + TypeScript strict, Prisma/PostgreSQL, ExcelJS (já instalado), Vitest, Untitled UI React (React Aria — componentes já no projeto: FileUploadDropZone, DataTable, Select, Button, Input, PageHeader, PageContainer).

## Global Constraints

- **TDD sempre:** teste falha (RED) → código mínimo (GREEN) → refatora. Nenhuma função de domínio sem teste que falhou antes.
- **Domínio puro:** lógica em `src/domain/`, funções puras, nomes em português, sem importar Next/Prisma/Supabase.
- **Auditoria de 100% (regra de ouro 4):** toda gravação de `HistoricoMensal` grava `EventoAuditoria` via `compararCampos(entidade, entidadeId, usuarioId, antes, depois)` + `registrarAlteracoes(eventos)`.
- **Permissão por fábrica (ADR-009):** toda leitura de dado de fábrica passa por `filtroFabricasPermitidas(usuario)` (retorna `string[]` de IDs permitidos, ou `null` para ADMIN = todas) antes de somar.
- **Import restrito a ADMIN:** tela e server actions de import checam `usuario.perfil === "ADMIN"` (padrão de `src/app/(app)/cadastros/usuarios/page.tsx:11` e `.../usuarios/actions.ts:14`).
- **YAGNI:** só o agregado mensal. Sem persistir cliente, número de pedido, número de NFe, nem linha individual. Sem quebra do gráfico por fábrica/cliente. Sem reimportação recorrente.
- **Chave de mês canônica:** string `"AAAA-MM"`, derivada em UTC (`getUTCFullYear`/`getUTCMonth`), igual ao padrão de `src/domain/analise/gap.ts`.
- **Commits pequenos**, um por tarefa concluída.
- **Verificação sem banco:** este ambiente pode não ter `DATABASE_URL`. Testes de domínio (Vitest com fixtures ExcelJS em memória), `npx prisma validate`, `npx prisma generate`, `npx tsc --noEmit` e `npm run build` rodam sem banco. `npx prisma migrate dev` exige `DATABASE_URL` — rode quando disponível.

---

### Task 1: ADR-012 + schema `HistoricoMensal` + migração

**Files:**
- Create: `docs/adr/ADR-012-historico-mensal-agregado.md`
- Modify: `prisma/schema.prisma` (novo enum + model + relação inversa em `Fabrica`)
- Create: `prisma/migrations/<timestamp>_historico_mensal/migration.sql` (gerado pelo Prisma)

**Interfaces:**
- Produces (Prisma Client, usado pelas Tasks 6 e 8): `prisma.historicoMensal` com campos `{ id, ano: number, mes: number, fabricaId: string, tipo: "PEDIDO" | "NFE", valor: Decimal, criadoEm }` e `@@unique([ano, mes, fabricaId, tipo])`.

- [ ] **Step 1: Escrever o ADR**

Crie `docs/adr/ADR-012-historico-mensal-agregado.md`:

```markdown
# ADR-012 — Histórico mensal agregado, desacoplado do modelo operacional

**Data:** 2026-07-20 · **Status:** Aceito · Resolve parte de RF39 (backlog V2)

## Decisão
Os dados históricos anteriores ao uso do sistema entram como **totais mensais
agregados** (`HistoricoMensal`: ano, mês, fábrica, tipo PEDIDO/NFE, valor), numa tabela
separada e SEM relação com `Pedido`/`NotaFiscal`. Não há persistência de item,
cliente, número de pedido ou chave de acesso da NFe.

## Por quê
- As planilhas de controle da empresa (pedidos recebidos e NFes emitidas por mês) só
  têm granularidade agregada: mês, fábrica, cliente (nome) e valor. Não têm item,
  quantidade, CNPJ nem chave de acesso (44 dígitos).
- O modelo operacional exige exatamente o que falta (item com referência/quantidade,
  `NotaFiscal.chaveAcesso` única e obrigatória). Forçar o histórico ali dentro
  exigiria inventar dados fictícios, violando a garantia de integridade e a auditoria
  que o sistema foi construído para dar.
- O uso pretendido é só um gráfico de continuidade no dashboard (evolução mensal),
  não a operação (baixa, chamado, rastreio) sobre esses registros.

## Consequência
- Tabela `HistoricoMensal` com `@@unique([ano, mes, fabricaId, tipo])` (chave de
  upsert: reimportar sobrescreve, não duplica).
- Respeita ADR-009: cada linha é vinculada a uma `Fabrica` cadastrada (FK), e as somas
  exibidas são filtradas por fábrica permitida.
- Import restrito a ADMIN (carga de configuração inicial, não operação do dia a dia).
- Evolução futura (consulta line-by-line, quebra por cliente) fica fora deste escopo.
```

- [ ] **Step 2: Adicionar o enum, o model e a relação inversa ao schema**

Ao final de `prisma/schema.prisma`, adicione:

```prisma
enum TipoHistoricoMensal {
  PEDIDO
  NFE
}

model HistoricoMensal {
  id        String              @id @default(cuid())
  ano       Int
  mes       Int
  fabricaId String
  fabrica   Fabrica             @relation(fields: [fabricaId], references: [id])
  tipo      TipoHistoricoMensal
  valor     Decimal             @db.Decimal(14, 2)
  criadoEm  DateTime            @default(now())

  @@unique([ano, mes, fabricaId, tipo])
}
```

No model `Fabrica` já existente, adicione a relação inversa na lista de campos (junto de `pedidos Pedido[]`):

```prisma
  historicoMensal HistoricoMensal[]
```

- [ ] **Step 3: Validar o schema (sem banco)**

Run: `npx prisma validate`
Expected: `The schema at prisma/schema.prisma is valid 🚀`

- [ ] **Step 4: Gerar o Prisma Client (sem banco)**

Run: `npx prisma generate`
Expected: `Generated Prisma Client` — o tipo `HistoricoMensal` e `prisma.historicoMensal` passam a existir para o TypeScript.

- [ ] **Step 5: Criar a migração (requer DATABASE_URL)**

Run: `npx prisma migrate dev --name historico_mensal`
Expected: migração criada em `prisma/migrations/<timestamp>_historico_mensal/` e aplicada sem erro.
Se `DATABASE_URL` não estiver disponível neste ambiente, pule este passo e registre que a migração deve ser gerada no ambiente com banco antes do deploy (os passos 3 e 4 já garantem que o schema é válido e o client compila).

- [ ] **Step 6: Commit**

```bash
git add docs/adr/ADR-012-historico-mensal-agregado.md prisma/schema.prisma prisma/migrations
git commit -m "feat: schema HistoricoMensal agregado + ADR-012"
```

---

### Task 2: Parser dos totais de pedidos (`extrairTotaisPedidos`)

**Files:**
- Create: `src/domain/historico/tipos.ts`
- Create: `src/domain/historico/pedidos.ts`
- Test: `src/domain/historico/__tests__/pedidos.test.ts`

**Interfaces:**
- Produces: `type TipoHistorico = "PEDIDO" | "NFE"` e `type TotalMensal = { ano: number; mes: number; fabricaNome: string; valor: number }` (em `tipos.ts`, consumidos por Tasks 3, 4, 6).
- Produces: `function extrairTotaisPedidos(buffer: Buffer): Promise<TotalMensal[]>`.

- [ ] **Step 1: Criar o arquivo de tipos compartilhados**

```typescript
// src/domain/historico/tipos.ts
export type TipoHistorico = "PEDIDO" | "NFE";

export type TotalMensal = {
  ano: number;
  mes: number; // 1-12
  fabricaNome: string;
  valor: number;
};
```

- [ ] **Step 2: Write the failing test**

```typescript
// src/domain/historico/__tests__/pedidos.test.ts
import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import { extrairTotaisPedidos } from "../pedidos";

// Recria a estrutura real inspecionada: linha 1 é um título mesclado, linha 2 é o
// cabeçalho real, dados a partir da linha 3. Colunas de resumo/fórmula à direita
// (F em diante) são ignoradas.
async function planilhaPedidos(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("OEM REP - PEDIDOS RECEBIDOS 26");
  ws.addRow(["ACOMPANHAMENTO 2026"]); // L1 título
  ws.addRow(["MÊS PEDIDO", "DIA PEDIDO", "FABRICANTE", "CLIENTE", "VR PEDIDO (S/IMP)"]); // L2 cabeçalho
  ws.addRow(["JANEIRO", new Date(Date.UTC(2026, 0, 10)), "AUTOFLEX", "ARAUTHO - TO", 1000]);
  ws.addRow(["JANEIRO", new Date(Date.UTC(2026, 0, 20)), "AUTOFLEX", "FEITOSA - MA", 500]);
  ws.addRow(["JANEIRO", new Date(Date.UTC(2026, 0, 25)), "BOWDEN", "DICAIXA - RS", 300]);
  ws.addRow(["FEVEREIRO", new Date(Date.UTC(2026, 1, 5)), "AUTOFLEX", "GIRAO", 700]);
  // uma segunda aba derivada (só fórmulas/resumo) deve ser ignorada
  const dash = wb.addWorksheet("DASHBOARD");
  dash.addRow(["DASHBOARD — PEDIDOS RECEBIDOS 2026"]);
  dash.addRow(["TOTAL GERAL (S/IMP)", "Nº PEDIDOS"]);
  dash.addRow([999999, 42]);
  const ab = await wb.xlsx.writeBuffer();
  return Buffer.from(ab);
}

describe("extrairTotaisPedidos", () => {
  it("agrupa e soma o valor de pedido por ano+mês+fabricante, derivando ano/mês da data", async () => {
    const totais = await extrairTotaisPedidos(await planilhaPedidos());

    expect(totais).toContainEqual({ ano: 2026, mes: 1, fabricaNome: "AUTOFLEX", valor: 1500 });
    expect(totais).toContainEqual({ ano: 2026, mes: 1, fabricaNome: "BOWDEN", valor: 300 });
    expect(totais).toContainEqual({ ano: 2026, mes: 2, fabricaNome: "AUTOFLEX", valor: 700 });
    expect(totais).toHaveLength(3);
  });

  it("ignora abas sem o cabeçalho de pedidos (ex.: DASHBOARD)", async () => {
    const totais = await extrairTotaisPedidos(await planilhaPedidos());
    // 999999 do DASHBOARD nunca entra em nenhum total
    expect(totais.some((t) => t.valor === 999999)).toBe(false);
  });

  it("lança erro quando nenhuma aba tem o cabeçalho esperado", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Qualquer");
    ws.addRow(["Coluna A", "Coluna B"]);
    const buffer = Buffer.from(await wb.xlsx.writeBuffer());
    await expect(extrairTotaisPedidos(buffer)).rejects.toThrow(/cabeçalho de pedidos/);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/domain/historico/__tests__/pedidos.test.ts`
Expected: FAIL — `Cannot find module '../pedidos'`

- [ ] **Step 4: Write minimal implementation**

```typescript
// src/domain/historico/pedidos.ts
import ExcelJS from "exceljs";
import type { TotalMensal } from "./tipos";

function normalizar(texto: string): string {
  return texto
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

const COL = {
  dia: ["dia pedido"],
  fabricante: ["fabricante"],
  valor: ["vr pedido (s/imp)", "vr pedido", "valor"],
};

type Indices = { dia: number; fabricante: number; valor: number };

// Procura, nas primeiras 5 linhas de uma aba, a linha de cabeçalho que contém as
// colunas de pedido. Retorna os índices das colunas e o número da linha, ou null.
function localizarCabecalho(ws: ExcelJS.Worksheet): { indices: Indices; linha: number } | null {
  for (let n = 1; n <= 5; n++) {
    const row = ws.getRow(n);
    const achado: Partial<Indices> = {};
    row.eachCell((celula, col) => {
      const texto = normalizar(String(celula.value ?? ""));
      if (COL.dia.includes(texto)) achado.dia = col;
      if (COL.fabricante.includes(texto)) achado.fabricante = col;
      if (COL.valor.includes(texto)) achado.valor = col;
    });
    if (achado.dia && achado.fabricante && achado.valor) {
      return { indices: achado as Indices, linha: n };
    }
  }
  return null;
}

function comoData(valor: unknown): Date | null {
  if (valor instanceof Date) return valor;
  return null;
}

export async function extrairTotaisPedidos(buffer: Buffer): Promise<TotalMensal[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);

  let alvo: { ws: ExcelJS.Worksheet; indices: Indices; linha: number } | null = null;
  for (const ws of wb.worksheets) {
    const cab = localizarCabecalho(ws);
    if (cab) {
      alvo = { ws, indices: cab.indices, linha: cab.linha };
      break;
    }
  }
  if (!alvo) {
    throw new Error("Nenhuma aba com o cabeçalho de pedidos (MÊS PEDIDO / DIA PEDIDO / FABRICANTE / VR PEDIDO).");
  }

  const grupos = new Map<string, TotalMensal>();
  const { ws, indices, linha } = alvo;

  ws.eachRow((row, numero) => {
    if (numero <= linha) return;
    const data = comoData(row.getCell(indices.dia).value);
    const fabricaNome = String(row.getCell(indices.fabricante).value ?? "").trim();
    const valor = Number(row.getCell(indices.valor).value ?? 0);
    if (!data || !fabricaNome || !Number.isFinite(valor)) return;

    const ano = data.getUTCFullYear();
    const mes = data.getUTCMonth() + 1;
    const chave = `${ano}-${mes}-${fabricaNome}`;
    const atual = grupos.get(chave) ?? { ano, mes, fabricaNome, valor: 0 };
    atual.valor += valor;
    grupos.set(chave, atual);
  });

  return [...grupos.values()];
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/domain/historico/__tests__/pedidos.test.ts`
Expected: PASS (3 testes)

- [ ] **Step 6: Commit**

```bash
git add src/domain/historico/tipos.ts src/domain/historico/pedidos.ts src/domain/historico/__tests__/pedidos.test.ts
git commit -m "feat: parser dos totais mensais de pedidos históricos"
```

---

### Task 3: Parser dos totais de NFe (`extrairTotaisNFe`)

**Files:**
- Create: `src/domain/historico/nfe.ts`
- Test: `src/domain/historico/__tests__/nfe.test.ts`

**Interfaces:**
- Consumes: `TotalMensal` de `src/domain/historico/tipos.ts` (Task 2).
- Produces: `const ABAS_RESUMO_NFE: string[]` (nomes normalizados de abas de resumo a ignorar) e `function extrairTotaisNFe(buffer: Buffer): Promise<TotalMensal[]>`.

- [ ] **Step 1: Write the failing test**

```typescript
// src/domain/historico/__tests__/nfe.test.ts
import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import { extrairTotaisNFe } from "../nfe";

// Estrutura real: uma aba por fábrica; L1 título mesclado, L2 cabeçalho
// (DIA / MÊS / VALOR / NFE / CLIENTE), dados a partir de L3. Abas de resumo
// (RESUMO GERAL etc.) são ignoradas pela allowlist.
async function planilhaNfe(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  for (const fab of ["AUTOFLEX", "BOWDEN"]) {
    const ws = wb.addWorksheet(fab);
    ws.addRow(["NOTAS EMITIDAS - 2026"]);
    ws.addRow(["DIA", "MÊS", "VALOR", "NFE", "CLIENTE"]);
    ws.addRow([new Date(Date.UTC(2026, 1, 2)), "FEVEREIRO", 100, 6488, ""]);
    ws.addRow([new Date(Date.UTC(2026, 1, 10)), "FEVEREIRO", 50, 6530, "GIRAO"]);
    ws.addRow([new Date(Date.UTC(2026, 2, 3)), "MARÇO", 200, 6600, ""]);
  }
  const resumo = wb.addWorksheet("RESUMO GERAL");
  resumo.addRow(["qualquer", "coisa"]);
  resumo.addRow([888888, 1]);
  const ab = await wb.xlsx.writeBuffer();
  return Buffer.from(ab);
}

describe("extrairTotaisNFe", () => {
  it("soma o valor por ano+mês usando o nome da aba como fábrica", async () => {
    const totais = await extrairTotaisNFe(await planilhaNfe());
    expect(totais).toContainEqual({ ano: 2026, mes: 2, fabricaNome: "AUTOFLEX", valor: 150 });
    expect(totais).toContainEqual({ ano: 2026, mes: 3, fabricaNome: "AUTOFLEX", valor: 200 });
    expect(totais).toContainEqual({ ano: 2026, mes: 2, fabricaNome: "BOWDEN", valor: 150 });
    expect(totais).toContainEqual({ ano: 2026, mes: 3, fabricaNome: "BOWDEN", valor: 200 });
  });

  it("ignora abas de resumo da allowlist (ex.: RESUMO GERAL)", async () => {
    const totais = await extrairTotaisNFe(await planilhaNfe());
    expect(totais.some((t) => t.fabricaNome === "RESUMO GERAL")).toBe(false);
    expect(totais.some((t) => t.valor === 888888)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domain/historico/__tests__/nfe.test.ts`
Expected: FAIL — `Cannot find module '../nfe'`

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/domain/historico/nfe.ts
import ExcelJS from "exceljs";
import type { TotalMensal } from "./tipos";

function normalizar(texto: string): string {
  return texto
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

// Abas conhecidas que NÃO são fábricas (visão/resumo derivado). Qualquer outra aba é
// tratada como uma fábrica; se o nome não casar com uma Fabrica cadastrada, isso vira
// pendência bloqueante no import (resolverFabricas / Task 4) — nunca descarte silencioso.
export const ABAS_RESUMO_NFE = [
  "resumo geral",
  "dashboard",
  "clientes vendedor",
  "comissao backoffice",
];

const COL = {
  dia: ["dia"],
  valor: ["valor"],
};

type Indices = { dia: number; valor: number };

function localizarCabecalho(ws: ExcelJS.Worksheet): { indices: Indices; linha: number } | null {
  for (let n = 1; n <= 5; n++) {
    const row = ws.getRow(n);
    const achado: Partial<Indices> = {};
    row.eachCell((celula, col) => {
      const texto = normalizar(String(celula.value ?? ""));
      if (COL.dia.includes(texto)) achado.dia = col;
      if (COL.valor.includes(texto)) achado.valor = col;
    });
    if (achado.dia && achado.valor) return { indices: achado as Indices, linha: n };
  }
  return null;
}

function comoData(valor: unknown): Date | null {
  return valor instanceof Date ? valor : null;
}

export async function extrairTotaisNFe(buffer: Buffer): Promise<TotalMensal[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);

  const grupos = new Map<string, TotalMensal>();

  for (const ws of wb.worksheets) {
    if (ABAS_RESUMO_NFE.includes(normalizar(ws.name))) continue;
    const cab = localizarCabecalho(ws);
    if (!cab) continue;

    const fabricaNome = ws.name.trim();
    ws.eachRow((row, numero) => {
      if (numero <= cab.linha) return;
      const data = comoData(row.getCell(cab.indices.dia).value);
      const valor = Number(row.getCell(cab.indices.valor).value ?? 0);
      if (!data || !Number.isFinite(valor)) return;

      const ano = data.getUTCFullYear();
      const mes = data.getUTCMonth() + 1;
      const chave = `${ano}-${mes}-${fabricaNome}`;
      const atual = grupos.get(chave) ?? { ano, mes, fabricaNome, valor: 0 };
      atual.valor += valor;
      grupos.set(chave, atual);
    });
  }

  return [...grupos.values()];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/domain/historico/__tests__/nfe.test.ts`
Expected: PASS (2 testes)

- [ ] **Step 5: Commit**

```bash
git add src/domain/historico/nfe.ts src/domain/historico/__tests__/nfe.test.ts
git commit -m "feat: parser dos totais mensais de NFes históricas"
```

---

### Task 4: Resolução de fábrica (`resolverFabricas`)

**Files:**
- Create: `src/domain/historico/resolucao.ts`
- Test: `src/domain/historico/__tests__/resolucao.test.ts`

**Interfaces:**
- Consumes: `TotalMensal`, `TipoHistorico` de `src/domain/historico/tipos.ts`.
- Produces:
  - `type FabricaCadastrada = { id: string; nome: string }`
  - `type LinhaHistorico = { ano: number; mes: number; fabricaId: string; fabricaNome: string; tipo: TipoHistorico; valor: number }`
  - `type ResultadoResolucao = { linhas: LinhaHistorico[]; pendencias: string[] }`
  - `function resolverFabricas(pedidos: TotalMensal[], nfe: TotalMensal[], fabricas: FabricaCadastrada[]): ResultadoResolucao`

- [ ] **Step 1: Write the failing test**

```typescript
// src/domain/historico/__tests__/resolucao.test.ts
import { describe, it, expect } from "vitest";
import { resolverFabricas, type FabricaCadastrada } from "../resolucao";
import type { TotalMensal } from "../tipos";

const cadastradas: FabricaCadastrada[] = [
  { id: "f-auto", nome: "AUTOFLEX" },
  { id: "f-bow", nome: "Bowden" },
];

const t = (fabricaNome: string, extra: Partial<TotalMensal> = {}): TotalMensal => ({
  ano: 2026,
  mes: 1,
  fabricaNome,
  valor: 100,
  ...extra,
});

describe("resolverFabricas", () => {
  it("resolve nome → id (case-insensitive) e marca o tipo de cada linha", () => {
    const r = resolverFabricas([t("AUTOFLEX")], [t("bowden")], cadastradas);
    expect(r.pendencias).toEqual([]);
    expect(r.linhas).toContainEqual({ ano: 2026, mes: 1, fabricaId: "f-auto", fabricaNome: "AUTOFLEX", tipo: "PEDIDO", valor: 100 });
    expect(r.linhas).toContainEqual({ ano: 2026, mes: 1, fabricaId: "f-bow", fabricaNome: "bowden", tipo: "NFE", valor: 100 });
  });

  it("coleta nome de fábrica não cadastrada como pendência (sem gerar linha)", () => {
    const r = resolverFabricas([t("SEINECA")], [], cadastradas);
    expect(r.linhas).toEqual([]);
    expect(r.pendencias).toEqual(["SEINECA"]);
  });

  it("não repete a mesma pendência", () => {
    const r = resolverFabricas([t("SEINECA"), t("SEINECA", { mes: 2 })], [t("SEINECA")], cadastradas);
    expect(r.pendencias).toEqual(["SEINECA"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domain/historico/__tests__/resolucao.test.ts`
Expected: FAIL — `Cannot find module '../resolucao'`

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/domain/historico/resolucao.ts
import type { TotalMensal, TipoHistorico } from "./tipos";

export type FabricaCadastrada = { id: string; nome: string };

export type LinhaHistorico = {
  ano: number;
  mes: number;
  fabricaId: string;
  fabricaNome: string;
  tipo: TipoHistorico;
  valor: number;
};

export type ResultadoResolucao = {
  linhas: LinhaHistorico[];
  pendencias: string[];
};

function normalizarNome(nome: string): string {
  return nome.trim().toLowerCase();
}

// Cruza os totais extraídos das planilhas contra as fábricas cadastradas. Nome que não
// casa vira pendência bloqueante (o import não segue enquanto houver pendência) — assim
// uma fábrica ainda não cadastrada nunca entra silenciosamente nem é descartada.
export function resolverFabricas(
  pedidos: TotalMensal[],
  nfe: TotalMensal[],
  fabricas: FabricaCadastrada[],
): ResultadoResolucao {
  const porNome = new Map(fabricas.map((f) => [normalizarNome(f.nome), f]));
  const linhas: LinhaHistorico[] = [];
  const pendencias = new Set<string>();

  const processar = (totais: TotalMensal[], tipo: TipoHistorico) => {
    for (const total of totais) {
      const fabrica = porNome.get(normalizarNome(total.fabricaNome));
      if (!fabrica) {
        pendencias.add(total.fabricaNome);
        continue;
      }
      linhas.push({
        ano: total.ano,
        mes: total.mes,
        fabricaId: fabrica.id,
        fabricaNome: total.fabricaNome,
        tipo,
        valor: total.valor,
      });
    }
  };

  processar(pedidos, "PEDIDO");
  processar(nfe, "NFE");

  return { linhas, pendencias: [...pendencias] };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/domain/historico/__tests__/resolucao.test.ts`
Expected: PASS (3 testes)

- [ ] **Step 5: Commit**

```bash
git add src/domain/historico/resolucao.ts src/domain/historico/__tests__/resolucao.test.ts
git commit -m "feat: resolução de fábrica para o import de histórico (pendências bloqueantes)"
```

---

### Task 5: Totais ao vivo e mesclagem de séries (`calcularTotaisMensaisAoVivo`, `combinarSeries`)

**Files:**
- Create: `src/domain/analise/totaisMensais.ts`
- Test: `src/domain/analise/__tests__/totaisMensais.test.ts`

**Interfaces:**
- Produces:
  - `type PontoMensal = { mes: string; valorPedido: number; valorNfe: number }` (`mes` = `"AAAA-MM"`)
  - `type PedidoParaTotais = { criadoEm: Date; itens: { quantidadePedida: number; valorUnitario: number }[] }`
  - `type NotaParaTotais = { dataEmissao: Date; totalNota: number }`
  - `type HistoricoMensalRow = { ano: number; mes: number; tipo: "PEDIDO" | "NFE"; valor: number }`
  - `function calcularTotaisMensaisAoVivo(pedidos: PedidoParaTotais[], notas: NotaParaTotais[]): PontoMensal[]`
  - `function combinarSeries(historico: HistoricoMensalRow[], aoVivo: PontoMensal[]): PontoMensal[]`

- [ ] **Step 1: Write the failing test**

```typescript
// src/domain/analise/__tests__/totaisMensais.test.ts
import { describe, it, expect } from "vitest";
import {
  calcularTotaisMensaisAoVivo,
  combinarSeries,
  type HistoricoMensalRow,
} from "../totaisMensais";

describe("calcularTotaisMensaisAoVivo", () => {
  it("soma pedidos (qtd × valor unit.) e NFes (total) por mês UTC", () => {
    const pontos = calcularTotaisMensaisAoVivo(
      [
        { criadoEm: new Date(Date.UTC(2026, 6, 5)), itens: [{ quantidadePedida: 2, valorUnitario: 10 }, { quantidadePedida: 1, valorUnitario: 5 }] },
        { criadoEm: new Date(Date.UTC(2026, 6, 20)), itens: [{ quantidadePedida: 3, valorUnitario: 10 }] },
      ],
      [{ dataEmissao: new Date(Date.UTC(2026, 6, 10)), totalNota: 100 }],
    );
    expect(pontos).toEqual([{ mes: "2026-07", valorPedido: 55, valorNfe: 100 }]);
  });
});

describe("combinarSeries", () => {
  it("mescla histórico e ao vivo por mês e ordena crescente", () => {
    const historico: HistoricoMensalRow[] = [
      { ano: 2026, mes: 1, tipo: "PEDIDO", valor: 1000 },
      { ano: 2026, mes: 1, tipo: "NFE", valor: 800 },
      { ano: 2026, mes: 2, tipo: "PEDIDO", valor: 500 },
    ];
    const aoVivo = [{ mes: "2026-07", valorPedido: 55, valorNfe: 100 }];

    const serie = combinarSeries(historico, aoVivo);

    expect(serie).toEqual([
      { mes: "2026-01", valorPedido: 1000, valorNfe: 800 },
      { mes: "2026-02", valorPedido: 500, valorNfe: 0 },
      { mes: "2026-07", valorPedido: 55, valorNfe: 100 },
    ]);
  });

  it("soma os dois lados quando o mesmo mês existe no histórico e ao vivo", () => {
    const serie = combinarSeries(
      [{ ano: 2026, mes: 7, tipo: "PEDIDO", valor: 10 }],
      [{ mes: "2026-07", valorPedido: 5, valorNfe: 3 }],
    );
    expect(serie).toEqual([{ mes: "2026-07", valorPedido: 15, valorNfe: 3 }]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domain/analise/__tests__/totaisMensais.test.ts`
Expected: FAIL — `Cannot find module '../totaisMensais'`

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/domain/analise/totaisMensais.ts
export type PontoMensal = {
  mes: string; // "AAAA-MM"
  valorPedido: number;
  valorNfe: number;
};

export type PedidoParaTotais = {
  criadoEm: Date;
  itens: { quantidadePedida: number; valorUnitario: number }[];
};

export type NotaParaTotais = {
  dataEmissao: Date;
  totalNota: number;
};

export type HistoricoMensalRow = {
  ano: number;
  mes: number;
  tipo: "PEDIDO" | "NFE";
  valor: number;
};

function chaveMes(data: Date): string {
  const ano = data.getUTCFullYear();
  const mes = String(data.getUTCMonth() + 1).padStart(2, "0");
  return `${ano}-${mes}`;
}

function chaveMesNumeros(ano: number, mes: number): string {
  return `${ano}-${String(mes).padStart(2, "0")}`;
}

function ponto(mapa: Map<string, PontoMensal>, mes: string): PontoMensal {
  const existente = mapa.get(mes);
  if (existente) return existente;
  const novo = { mes, valorPedido: 0, valorNfe: 0 };
  mapa.set(mes, novo);
  return novo;
}

export function calcularTotaisMensaisAoVivo(
  pedidos: PedidoParaTotais[],
  notas: NotaParaTotais[],
): PontoMensal[] {
  const mapa = new Map<string, PontoMensal>();

  for (const pedido of pedidos) {
    const valor = pedido.itens.reduce((soma, i) => soma + i.quantidadePedida * i.valorUnitario, 0);
    ponto(mapa, chaveMes(pedido.criadoEm)).valorPedido += valor;
  }
  for (const nota of notas) {
    ponto(mapa, chaveMes(nota.dataEmissao)).valorNfe += nota.totalNota;
  }

  return [...mapa.values()].sort((a, b) => a.mes.localeCompare(b.mes));
}

export function combinarSeries(
  historico: HistoricoMensalRow[],
  aoVivo: PontoMensal[],
): PontoMensal[] {
  const mapa = new Map<string, PontoMensal>();

  for (const linha of historico) {
    const p = ponto(mapa, chaveMesNumeros(linha.ano, linha.mes));
    if (linha.tipo === "PEDIDO") p.valorPedido += linha.valor;
    else p.valorNfe += linha.valor;
  }
  for (const p of aoVivo) {
    const alvo = ponto(mapa, p.mes);
    alvo.valorPedido += p.valorPedido;
    alvo.valorNfe += p.valorNfe;
  }

  return [...mapa.values()].sort((a, b) => a.mes.localeCompare(b.mes));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/domain/analise/__tests__/totaisMensais.test.ts`
Expected: PASS (3 testes)

- [ ] **Step 5: Commit**

```bash
git add src/domain/analise/totaisMensais.ts src/domain/analise/__tests__/totaisMensais.test.ts
git commit -m "feat: totais mensais ao vivo e mesclagem com histórico"
```

---

### Task 6: Server actions do import (`analisarHistorico`, `confirmarImportacaoHistorico`)

**Files:**
- Create: `src/app/(app)/historico/importar/actions.ts`

**Interfaces:**
- Consumes: `extrairTotaisPedidos` (Task 2), `extrairTotaisNFe` (Task 3), `resolverFabricas`/`LinhaHistorico` (Task 4), `obterUsuarioLogado` (`@/lib/sessao`), `compararCampos` (`@/domain/auditoria/evento`), `registrarAlteracoes` (`@/lib/auditoria`), `prisma` (`@/lib/prisma`).
- Produces:
  - `type ResultadoAnalise = { erro?: string; linhas?: LinhaHistorico[]; pendencias?: string[] }`
  - `async function analisarHistorico(formData: FormData): Promise<ResultadoAnalise>` (lê os campos `pedidos` e `nfe` do FormData, cada um opcional)
  - `async function confirmarImportacaoHistorico(linhas: LinhaHistorico[]): Promise<{ erros: string[] }>`

> Segue a convenção do projeto: server action de persistência fina não tem teste dedicado (a regra que importa está coberta no domínio, Tasks 2–4). A verificação é `tsc` + `build` + navegador.

- [ ] **Step 1: Implementar as server actions**

```typescript
// src/app/(app)/historico/importar/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { obterUsuarioLogado } from "@/lib/sessao";
import { extrairTotaisPedidos } from "@/domain/historico/pedidos";
import { extrairTotaisNFe } from "@/domain/historico/nfe";
import { resolverFabricas, type LinhaHistorico } from "@/domain/historico/resolucao";
import type { TotalMensal } from "@/domain/historico/tipos";
import { compararCampos } from "@/domain/auditoria/evento";
import { registrarAlteracoes } from "@/lib/auditoria";

export type ResultadoAnalise = {
  erro?: string;
  linhas?: LinhaHistorico[];
  pendencias?: string[];
};

async function lerBuffer(arquivo: File | null): Promise<Buffer | null> {
  if (!arquivo || arquivo.size === 0) return null;
  return Buffer.from(await arquivo.arrayBuffer());
}

export async function analisarHistorico(formData: FormData): Promise<ResultadoAnalise> {
  const usuario = await obterUsuarioLogado();
  if (!usuario || usuario.perfil !== "ADMIN") {
    return { erro: "Apenas ADMIN pode importar histórico." };
  }

  const bufferPedidos = await lerBuffer(formData.get("pedidos") as File | null);
  const bufferNfe = await lerBuffer(formData.get("nfe") as File | null);
  if (!bufferPedidos && !bufferNfe) {
    return { erro: "Selecione ao menos uma planilha (pedidos ou NFes)." };
  }

  let totaisPedidos: TotalMensal[] = [];
  let totaisNfe: TotalMensal[] = [];
  try {
    if (bufferPedidos) totaisPedidos = await extrairTotaisPedidos(bufferPedidos);
    if (bufferNfe) totaisNfe = await extrairTotaisNFe(bufferNfe);
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : "Falha ao ler a planilha." };
  }

  const fabricas = await prisma.fabrica.findMany({ select: { id: true, nome: true } });
  const { linhas, pendencias } = resolverFabricas(totaisPedidos, totaisNfe, fabricas);

  return { linhas, pendencias };
}

export async function confirmarImportacaoHistorico(
  linhas: LinhaHistorico[],
): Promise<{ erros: string[] }> {
  const usuario = await obterUsuarioLogado();
  if (!usuario || usuario.perfil !== "ADMIN") {
    return { erros: ["Apenas ADMIN pode importar histórico."] };
  }
  if (linhas.length === 0) {
    return { erros: ["Nada para importar."] };
  }
  if (linhas.some((l) => !l.fabricaId)) {
    return { erros: ["Há fábricas não cadastradas. Resolva as pendências antes de importar."] };
  }

  for (const linha of linhas) {
    const anterior = await prisma.historicoMensal.findUnique({
      where: {
        ano_mes_fabricaId_tipo: {
          ano: linha.ano,
          mes: linha.mes,
          fabricaId: linha.fabricaId,
          tipo: linha.tipo,
        },
      },
    });

    const registro = await prisma.historicoMensal.upsert({
      where: {
        ano_mes_fabricaId_tipo: {
          ano: linha.ano,
          mes: linha.mes,
          fabricaId: linha.fabricaId,
          tipo: linha.tipo,
        },
      },
      create: {
        ano: linha.ano,
        mes: linha.mes,
        fabricaId: linha.fabricaId,
        tipo: linha.tipo,
        valor: linha.valor,
      },
      update: { valor: linha.valor },
    });

    await registrarAlteracoes(
      compararCampos(
        "HistoricoMensal",
        registro.id,
        usuario.id,
        { valor: anterior ? Number(anterior.valor) : null },
        { valor: linha.valor },
      ),
    );
  }

  revalidatePath("/");
  return { erros: [] };
}
```

- [ ] **Step 2: Verificar tipos e build**

Run: `npx tsc --noEmit`
Expected: sem erros (o Prisma Client já foi gerado na Task 1, então `prisma.historicoMensal` e a chave composta `ano_mes_fabricaId_tipo` existem).

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/historico/importar/actions.ts"
git commit -m "feat: server actions de import de histórico com upsert e auditoria"
```

---

### Task 7: Tela de import do histórico

**Files:**
- Create: `src/app/(app)/historico/importar/page.tsx`

**Interfaces:**
- Consumes: `analisarHistorico`, `confirmarImportacaoHistorico`, `type ResultadoAnalise` (Task 6); `LinhaHistorico` (Task 4). Componentes Untitled UI: `PageContainer`, `PageHeader`, `Button`, `FileUploadDropZone`, `DataTable`.

- [ ] **Step 1: Implementar a tela**

```tsx
// src/app/(app)/historico/importar/page.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { analisarHistorico, confirmarImportacaoHistorico } from "./actions";
import type { LinhaHistorico } from "@/domain/historico/resolucao";
import { PageContainer } from "@/components/layouts/page-container";
import { PageHeader } from "@/components/patterns/page-header";
import { Button } from "@/components/ui/buttons/button";
import { FileUploadDropZone } from "@/components/application/file-upload/file-upload-base";
import { DataTable } from "@/components/patterns/data-table";

const MESES = ["", "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type LinhaView = LinhaHistorico & { _id: string };

export default function ImportarHistoricoPage() {
  const router = useRouter();
  const [pedidosFile, setPedidosFile] = useState<File | null>(null);
  const [nfeFile, setNfeFile] = useState<File | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [analisando, setAnalisando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [linhas, setLinhas] = useState<LinhaHistorico[] | null>(null);
  const [pendencias, setPendencias] = useState<string[]>([]);

  async function handleAnalisar() {
    setErro(null);
    setAnalisando(true);
    const formData = new FormData();
    if (pedidosFile) formData.append("pedidos", pedidosFile);
    if (nfeFile) formData.append("nfe", nfeFile);
    const resultado = await analisarHistorico(formData);
    setAnalisando(false);
    if (resultado.erro) {
      setErro(resultado.erro);
      return;
    }
    setLinhas(resultado.linhas ?? []);
    setPendencias(resultado.pendencias ?? []);
  }

  async function handleConfirmar() {
    if (!linhas) return;
    setErro(null);
    setConfirmando(true);
    const resultado = await confirmarImportacaoHistorico(linhas);
    setConfirmando(false);
    if (resultado.erros.length > 0) {
      setErro(resultado.erros.join(" "));
      return;
    }
    router.push("/");
  }

  const view: LinhaView[] = (linhas ?? []).map((l, i) => ({ ...l, _id: String(i) }));
  const temPendencia = pendencias.length > 0;

  return (
    <PageContainer>
      <PageHeader titulo="Importar histórico" descricao="Envie as planilhas de controle (pedidos recebidos e NFes emitidas) para alimentar o gráfico histórico do dashboard." />

      {!linhas && (
        <div className="flex max-w-2xl flex-col gap-5 rounded-xl bg-primary p-6 ring-1 ring-secondary">
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-primary">Planilha de pedidos recebidos</p>
            <FileUploadDropZone accept=".xlsx" allowsMultiple={false} hint="Apenas .xlsx" onDropFiles={(f) => setPedidosFile(f[0] ?? null)} />
            {pedidosFile && <p className="text-sm text-secondary">Selecionado: <span className="font-medium text-primary">{pedidosFile.name}</span></p>}
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-primary">Planilha de NFes emitidas</p>
            <FileUploadDropZone accept=".xlsx" allowsMultiple={false} hint="Apenas .xlsx" onDropFiles={(f) => setNfeFile(f[0] ?? null)} />
            {nfeFile && <p className="text-sm text-secondary">Selecionado: <span className="font-medium text-primary">{nfeFile.name}</span></p>}
          </div>
          {erro && <p className="text-sm text-error-primary">{erro}</p>}
          <div>
            <Button color="primary" isDisabled={!pedidosFile && !nfeFile} isLoading={analisando} onClick={handleAnalisar}>
              Analisar planilhas
            </Button>
          </div>
        </div>
      )}

      {linhas && (
        <div className="flex flex-col gap-6">
          {temPendencia && (
            <div className="flex flex-col gap-2 rounded-xl bg-primary p-5 ring-1 ring-error-primary">
              <p className="text-sm font-medium text-error-primary">Fábricas não cadastradas — cadastre-as antes de importar:</p>
              <ul className="list-inside list-disc text-sm text-secondary">
                {pendencias.map((nome) => <li key={nome}>{nome}</li>)}
              </ul>
              <Link href="/cadastros" className="text-sm text-brand-secondary hover:underline">Ir para Cadastros</Link>
            </div>
          )}

          <DataTable<LinhaView>
            ariaLabel="Totais mensais a importar"
            titulo="Totais mensais"
            contadorBadge={`${view.length} linhas`}
            data={view}
            getRowId={(l) => l._id}
            columns={[
              { id: "periodo", header: "Período", isRowHeader: true, render: (l) => <span className="font-medium text-primary">{MESES[l.mes]}/{l.ano}</span> },
              { id: "fabrica", header: "Fábrica", render: (l) => l.fabricaNome },
              { id: "tipo", header: "Tipo", render: (l) => (l.tipo === "PEDIDO" ? "Pedidos" : "NFes") },
              { id: "valor", header: "Valor", render: (l) => brl(l.valor) },
            ]}
          />

          {erro && <p className="text-sm text-error-primary">{erro}</p>}
          <div className="flex justify-end gap-3">
            <Button color="secondary" onClick={() => { setLinhas(null); setPendencias([]); }}>Escolher outros arquivos</Button>
            <Button color="primary" isDisabled={temPendencia || view.length === 0} isLoading={confirmando} onClick={handleConfirmar}>
              Confirmar importação
            </Button>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
```

- [ ] **Step 2: Verificar tipos e build**

Run: `npx tsc --noEmit && npm run build`
Expected: sem erros; a rota `/historico/importar` aparece na saída do build.

- [ ] **Step 3: Verificar manualmente no navegador**

Run: `npm run dev`, logar como ADMIN, abrir `http://localhost:3000/historico/importar`, subir uma planilha de teste (pode reusar as amostras reais). Conferir que: (a) a grade de totais mensais aparece; (b) se houver fábrica não cadastrada, o bloco vermelho de pendências aparece e "Confirmar" fica desabilitado; (c) com tudo resolvido, "Confirmar" redireciona para o dashboard.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/historico/importar/page.tsx"
git commit -m "feat: tela de import de histórico (upload, revisão, pendências)"
```

---

### Task 8: Query da série mensal + gráfico no dashboard

**Files:**
- Modify: `src/app/(app)/queries.ts` (adicionar `buscarSerieMensal`)
- Modify: `src/app/(app)/page.tsx` (nova seção de gráfico + link ADMIN para o import)

**Interfaces:**
- Consumes: `calcularTotaisMensaisAoVivo`, `combinarSeries`, `type PontoMensal`, `type HistoricoMensalRow` (Task 5); `filtroFabricasPermitidas` (`@/lib/authz`); `UsuarioSessao` (`@/lib/sessao`); `prisma`.
- Produces: `async function buscarSerieMensal(usuario: UsuarioSessao): Promise<PontoMensal[]>`.

- [ ] **Step 1: Adicionar a query `buscarSerieMensal`**

No topo de `src/app/(app)/queries.ts`, adicione os imports:

```typescript
import {
  calcularTotaisMensaisAoVivo,
  combinarSeries,
  type HistoricoMensalRow,
  type PontoMensal,
} from "@/domain/analise/totaisMensais";
```

Ao final do arquivo, adicione a função:

```typescript
export async function buscarSerieMensal(usuario: UsuarioSessao): Promise<PontoMensal[]> {
  const fabricasPermitidas = filtroFabricasPermitidas(usuario);
  const wherePedidoFabrica = fabricasPermitidas ? { fabricaId: { in: fabricasPermitidas } } : {};
  const whereNotaFabrica = fabricasPermitidas
    ? { pedidos: { some: { pedido: { fabricaId: { in: fabricasPermitidas } } } } }
    : {};
  const whereHistoricoFabrica = fabricasPermitidas ? { fabricaId: { in: fabricasPermitidas } } : {};

  const [historicoRaw, pedidos, notas] = await Promise.all([
    prisma.historicoMensal.findMany({ where: whereHistoricoFabrica }),
    prisma.pedido.findMany({
      where: wherePedidoFabrica,
      include: { itens: true },
    }),
    prisma.notaFiscal.findMany({ where: whereNotaFabrica }),
  ]);

  const historico: HistoricoMensalRow[] = historicoRaw.map((h) => ({
    ano: h.ano,
    mes: h.mes,
    tipo: h.tipo,
    valor: Number(h.valor),
  }));

  const aoVivo = calcularTotaisMensaisAoVivo(
    pedidos.map((p) => ({
      criadoEm: p.criadoEm,
      itens: p.itens.map((i) => ({
        quantidadePedida: i.quantidadePedida,
        valorUnitario: Number(i.valorUnitario),
      })),
    })),
    notas.map((n) => ({ dataEmissao: n.dataEmissao, totalNota: Number(n.totalNota) })),
  );

  return combinarSeries(historico, aoVivo);
}
```

- [ ] **Step 2: Renderizar o gráfico no dashboard**

Em `src/app/(app)/page.tsx`, adicione o import da nova query junto do existente:

```typescript
import { buscarResumoDashboard, buscarSerieMensal } from "./queries";
```

Logo após `const { kpis, fila } = await buscarResumoDashboard(usuario);`, busque a série e prepare a escala:

```typescript
  const serie = await buscarSerieMensal(usuario);
  const serieMax = Math.max(1, ...serie.map((p) => Math.max(p.valorPedido, p.valorNfe)));
  const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const rotuloMes = (mes: string) => {
    const [ano, m] = mes.split("-");
    return `${["", "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"][Number(m)]}/${ano.slice(2)}`;
  };
```

Insira esta seção logo após o grid de cartões de KPI (antes do bloco "Fila do dia"):

```tsx
      <div className="flex flex-col gap-4 rounded-xl bg-primary p-6 ring-1 ring-secondary">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-primary">Pedidos × NFes por mês</h2>
          {usuario.perfil === "ADMIN" && (
            <Link href="/historico/importar" className="text-sm text-brand-secondary hover:underline">
              Importar histórico
            </Link>
          )}
        </div>

        {serie.length === 0 ? (
          <p className="text-sm text-tertiary">Sem dados ainda. Importe o histórico ou registre pedidos e NFes.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {serie.map((p) => (
              <li key={p.mes} className="flex flex-col gap-1">
                <span className="text-xs font-medium text-tertiary">{rotuloMes(p.mes)}</span>
                <div className="flex items-center gap-3">
                  <span className="w-10 shrink-0 text-xs text-quaternary">Ped.</span>
                  <span className="h-3 rounded-full bg-fg-brand-primary" style={{ width: `${Math.max(2, (p.valorPedido / serieMax) * 100)}%` }} aria-hidden />
                  <span className="text-sm text-primary">{brl(p.valorPedido)}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-10 shrink-0 text-xs text-quaternary">NFe</span>
                  <span className="h-3 rounded-full bg-fg-success-primary" style={{ width: `${Math.max(2, (p.valorNfe / serieMax) * 100)}%` }} aria-hidden />
                  <span className="text-sm text-primary">{brl(p.valorNfe)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
```

> `Link` já está importado no topo de `page.tsx` (`import Link from "next/link"`). As classes `bg-fg-brand-primary` (barra de pedidos) e `bg-fg-success-primary` (barra de NFe) já existem em `src/styles/theme.css` — `bg-fg-brand-primary` já é usada no próprio dashboard.

- [ ] **Step 3: Rodar a suíte completa de domínio + tipos + build**

Run: `npx vitest run src/domain && npx tsc --noEmit && npm run build`
Expected: todos os testes de domínio passam; sem erros de tipo; build conclui e o dashboard `/` continua compilando.

- [ ] **Step 4: Verificar manualmente no navegador**

Run: `npm run dev`, logar, abrir `/`. Conferir que a seção "Pedidos × NFes por mês" aparece com as barras (pedido em vermelho/brand, NFe em verde), ordenadas do mês mais antigo ao mais recente, e que o link "Importar histórico" só aparece para ADMIN. Se houver histórico importado, os meses anteriores devem aparecer antes dos meses com dados operacionais.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/queries.ts" "src/app/(app)/page.tsx"
git commit -m "feat: gráfico de pedidos × NFes por mês no dashboard (histórico + ao vivo)"
```

---

## Self-Review

**Cobertura do spec:**
- §3 (modelo `HistoricoMensal` + ADR) → Task 1.
- §4 (`extrairTotaisPedidos` com detecção de cabeçalho e aba `DASHBOARD` ignorada; `extrairTotaisNFe` com allowlist de abas de resumo) → Tasks 2 e 3.
- §4 (aba/fábrica desconhecida vira pendência, nunca descarte silencioso) → Task 4 (`resolverFabricas`) + bloqueio na Task 6/7.
- §5 (fluxo upload → análise → revisão → confirmação, ADMIN-only, pendências bloqueantes, upsert idempotente) → Tasks 6 e 7.
- §5 (auditoria de 100% em `HistoricoMensal`) → Task 6.
- §6 (gráfico mensal no dashboard, série histórica + ao vivo, filtrado por fábrica permitida, ordem crescente, duas séries sem quebra por fábrica) → Tasks 5 e 8.
- §7 (testes de domínio com fixtures ExcelJS; sem teste Prisma dedicado) → Tasks 2–5 têm teste; Tasks 1, 6, 7, 8 verificam por `validate`/`generate`/`tsc`/`build`/navegador.
- Fora do escopo (§8): nenhuma tela de consulta line-by-line, sem recorrência, sem quebra por fábrica/cliente no gráfico, acesso só ADMIN — respeitado em todas as tarefas.

**Placeholders:** nenhum "TBD"/"implementar depois" — todos os passos de código têm o código completo.

**Consistência de tipos:** `TotalMensal`/`TipoHistorico` (Task 2) reusados sem alteração em Tasks 3, 4, 6. `LinhaHistorico` (Task 4) é o tipo que trafega da Task 6 (retorno de `analisarHistorico`) para a Task 7 (props da grade) e de volta para `confirmarImportacaoHistorico`. `PontoMensal`/`HistoricoMensalRow` (Task 5) usados por `buscarSerieMensal` (Task 8) e pela página. A chave composta do upsert (`ano_mes_fabricaId_tipo`) na Task 6 corresponde exatamente ao `@@unique([ano, mes, fabricaId, tipo])` da Task 1.

**Nota para o executor:** o teste `src/components/__tests__/nav.test.ts` já está QUEBRADO antes deste plano (ficou desatualizado quando `/auditoria` entrou no Épico 7) e NÃO é tocado por este plano — o ponto de entrada do import é um link ADMIN no dashboard, não um item de menu. Não conte esse teste como regressão desta feature.
