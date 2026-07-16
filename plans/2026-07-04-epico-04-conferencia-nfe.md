# Épico 4 — Conferência de NFe — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Importar o XML da NFe, conferir item a item contra as pendências dos
pedidos, confirmar a baixa (parcial ou integral, progressiva por várias NFes), tratar
NFe que cobre vários pedidos do mesmo cliente, e exibir o relatório de cruzamento por
NFe.

**Architecture:** Toda a regra de conferência/baixa/vínculo é feita em funções puras
sob `src/domain/nfe/`, sem tocar em Next/Prisma (mesmo padrão do Épico 3). As telas
(`src/app/(app)/conferencia/`) e as *server actions* são finas: parseiam o XML, buscam
dados no Prisma, chamam o domínio e persistem o resultado. O parser usa
`fast-xml-parser`. Uma nova tabela de ligação N:N (`NotaFiscalPedido`) resolve "NFe
cobre vários pedidos" (RN10) e `ItemFaturado` resolve "item atendido por várias NFes"
(RN11 — baixa parcial progressiva).

**Tech Stack:** Next.js (App Router) + TypeScript strict, Prisma/PostgreSQL,
`fast-xml-parser` (novo), Vitest, shadcn/ui (componentes já instalados: Button, Input,
Label, Card, Table, Badge, Tabs).

## Global Constraints

- TDD sempre: teste falha (RED) → código mínimo (GREEN) → refatora. Nenhuma função de
  domínio sem teste que falhou antes.
- Lógica de domínio em `src/domain/nfe/`, funções puras, nomes em português, sem
  importar Next/Prisma/Supabase.
- Toda alteração em `Pedido`, `ItemPedido` e `NotaFiscal` grava `EventoAuditoria` via
  `compararCampos` + `registrarAlteracoes` (padrão já usado em
  `src/app/(app)/pedidos/[id]/actions.ts`).
- RN04: conferência compara CNPJ destinatário + referência + quantidade + valor
  unitário.
- RN09/RN10/RN11 e ADR-008: um pedido pode ter várias NFes; uma NFe pode cobrir vários
  pedidos **do mesmo cliente**; um item pode ser atendido por várias NFes (baixa
  progressiva via `ItemFaturado`); a NFe nasce em status `TRANSITO`.
- ADR-005: item resolvido por `FORA_DE_FABRICACAO`/`DESISTENCIA` não volta a ser
  alterado por baixa de NFe.
- Rotas de API "passthrough" sem lógica de negócio (ex.: `/api/fabricas`,
  `/api/clientes` já existentes) não têm teste dedicado neste projeto — mantenha essa
  convenção para as novas rotas puramente de leitura.
- Commits pequenos, um por tarefa concluída.

---

### Task 1: Parser de NFe XML

**Files:**
- Modify: `package.json` (adicionar dependência `fast-xml-parser`)
- Create: `src/domain/nfe/parser.ts`
- Test: `src/domain/nfe/__tests__/parser.test.ts`

**Interfaces:**
- Produces: `type ItemNFe = { referencia: string; descricao: string; quantidade: number; valorUnitario: number }`
- Produces: `type NFeExtraida = { chaveAcesso: string; numero: string; emitenteCnpj: string; destinatarioCnpj: string; dataEmissao: string; totalProdutos: number; totalNota: number; itens: ItemNFe[] }`
- Produces: `function extrairNFeDoXml(xml: string): NFeExtraida` (lança `Error` se o XML não tiver `infNFe`)

- [ ] **Step 1: Instalar a dependência**

Run: `npm install fast-xml-parser`

- [ ] **Step 2: Write the failing test**

```typescript
// src/domain/nfe/__tests__/parser.test.ts
import { describe, it, expect } from "vitest";
import { extrairNFeDoXml } from "../parser";

const XML_DOIS_ITENS = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <NFe>
    <infNFe Id="NFe35260711444777000161550010000012341123456789" versao="4.00">
      <ide>
        <nNF>1234</nNF>
        <dhEmi>2026-07-01T10:00:00-03:00</dhEmi>
      </ide>
      <emit>
        <CNPJ>11444777000161</CNPJ>
      </emit>
      <dest>
        <CNPJ>11222333000181</CNPJ>
      </dest>
      <det nItem="1">
        <prod>
          <cProd>REF-1</cProd>
          <xProd>Peça 1</xProd>
          <qCom>10.0000</qCom>
          <vUnCom>25.50</vUnCom>
        </prod>
      </det>
      <det nItem="2">
        <prod>
          <cProd>REF-2</cProd>
          <xProd>Peça 2</xProd>
          <qCom>5.0000</qCom>
          <vUnCom>12.00</vUnCom>
        </prod>
      </det>
      <total>
        <ICMSTot>
          <vProd>315.00</vProd>
          <vNF>320.00</vNF>
        </ICMSTot>
      </total>
    </infNFe>
  </NFe>
</nfeProc>`;

const XML_UM_ITEM = XML_DOIS_ITENS.replace(
  /<det nItem="2">[\s\S]*?<\/det>\s*/,
  "",
);

describe("extrairNFeDoXml", () => {
  it("extrai cabeçalho e itens de uma NFe com múltiplos itens", () => {
    const nfe = extrairNFeDoXml(XML_DOIS_ITENS);

    expect(nfe.chaveAcesso).toBe("35260711444777000161550010000012341123456789");
    expect(nfe.numero).toBe("1234");
    expect(nfe.emitenteCnpj).toBe("11444777000161");
    expect(nfe.destinatarioCnpj).toBe("11222333000181");
    expect(nfe.totalProdutos).toBe(315);
    expect(nfe.totalNota).toBe(320);
    expect(nfe.itens).toHaveLength(2);
    expect(nfe.itens[0]).toEqual({
      referencia: "REF-1",
      descricao: "Peça 1",
      quantidade: 10,
      valorUnitario: 25.5,
    });
  });

  it("normaliza NFe com um único item (o parser não retorna array nesse caso)", () => {
    const nfe = extrairNFeDoXml(XML_UM_ITEM);

    expect(nfe.itens).toHaveLength(1);
    expect(nfe.itens[0].referencia).toBe("REF-1");
  });

  it("lança erro para XML que não é uma NFe", () => {
    expect(() => extrairNFeDoXml("<algo><outraCoisa/></algo>")).toThrow(/NFe válida/);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/domain/nfe/__tests__/parser.test.ts`
Expected: FAIL — `Cannot find module '../parser'`

- [ ] **Step 4: Write minimal implementation**

```typescript
// src/domain/nfe/parser.ts
import { XMLParser } from "fast-xml-parser";

export type ItemNFe = {
  referencia: string;
  descricao: string;
  quantidade: number;
  valorUnitario: number;
};

export type NFeExtraida = {
  chaveAcesso: string;
  numero: string;
  emitenteCnpj: string;
  destinatarioCnpj: string;
  dataEmissao: string;
  totalProdutos: number;
  totalNota: number;
  itens: ItemNFe[];
};

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  isArray: (nome) => nome === "det",
});

function campo(obj: unknown, ...caminho: string[]): unknown {
  let atual = obj;
  for (const chave of caminho) {
    if (atual === null || typeof atual !== "object") return undefined;
    atual = (atual as Record<string, unknown>)[chave];
  }
  return atual;
}

function texto(valor: unknown): string {
  return valor === undefined || valor === null ? "" : String(valor);
}

function numero(valor: unknown): number {
  return Number(valor ?? 0);
}

function extrairChaveDoId(id: string): string {
  return id.replace(/^NFe/, "");
}

// RF12: extrai emitente/destinatário, chave de acesso, itens, quantidades e valores
// de um XML de NFe. Meta de performance: < 5 s (PRD §6.1) — não testado aqui pois
// XMLParser síncrono sobre um único documento é ordens de magnitude mais rápido.
export function extrairNFeDoXml(xml: string): NFeExtraida {
  const doc = parser.parse(xml) as Record<string, unknown>;
  const infNFe = campo(doc, "nfeProc", "NFe", "infNFe") ?? campo(doc, "NFe", "infNFe");

  if (!infNFe || typeof infNFe !== "object") {
    throw new Error("XML não é uma NFe válida: elemento infNFe não encontrado.");
  }

  const detBruto = campo(infNFe, "det");
  const det = Array.isArray(detBruto) ? detBruto : [];

  return {
    chaveAcesso: extrairChaveDoId(texto(campo(infNFe, "@_Id"))),
    numero: texto(campo(infNFe, "ide", "nNF")),
    emitenteCnpj: texto(campo(infNFe, "emit", "CNPJ")),
    destinatarioCnpj: texto(campo(infNFe, "dest", "CNPJ")),
    dataEmissao: texto(campo(infNFe, "ide", "dhEmi")),
    totalProdutos: numero(campo(infNFe, "total", "ICMSTot", "vProd")),
    totalNota: numero(campo(infNFe, "total", "ICMSTot", "vNF")),
    itens: det.map((item) => ({
      referencia: texto(campo(item, "prod", "cProd")),
      descricao: texto(campo(item, "prod", "xProd")),
      quantidade: numero(campo(item, "prod", "qCom")),
      valorUnitario: numero(campo(item, "prod", "vUnCom")),
    })),
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/domain/nfe/__tests__/parser.test.ts`
Expected: PASS (3 testes)

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/domain/nfe/parser.ts src/domain/nfe/__tests__/parser.test.ts
git commit -m "feat: parser de NFe XML (RF12)"
```

---

### Task 2: Conferência item a item

**Files:**
- Create: `src/domain/nfe/conferencia.ts`
- Test: `src/domain/nfe/__tests__/conferencia.test.ts`

**Interfaces:**
- Consumes: `ItemNFe` de `src/domain/nfe/parser.ts` (Task 1)
- Produces: `type PendenciaItem = { itemPedidoId: string; pedidoId: string; clienteCnpj: string; referencia: string; quantidadePendente: number; valorUnitario: number }`
- Produces: `type ResultadoConferenciaItem = { itemNFe: ItemNFe; pendencia: PendenciaItem | null; divergencias: string[] }`
- Produces: `function conferirItens(destinatarioCnpj: string, itensNFe: ItemNFe[], pendencias: PendenciaItem[]): ResultadoConferenciaItem[]`

- [ ] **Step 1: Write the failing test**

```typescript
// src/domain/nfe/__tests__/conferencia.test.ts
import { describe, it, expect } from "vitest";
import { conferirItens, type PendenciaItem } from "../conferencia";
import type { ItemNFe } from "../parser";

const CNPJ_CLIENTE = "11222333000181";

const pendencia = (sobrescreve: Partial<PendenciaItem> = {}): PendenciaItem => ({
  itemPedidoId: "item-1",
  pedidoId: "pedido-1",
  clienteCnpj: CNPJ_CLIENTE,
  referencia: "REF-1",
  quantidadePendente: 10,
  valorUnitario: 25.5,
  ...sobrescreve,
});

const itemNFe = (sobrescreve: Partial<ItemNFe> = {}): ItemNFe => ({
  referencia: "REF-1",
  descricao: "Peça 1",
  quantidade: 10,
  valorUnitario: 25.5,
  ...sobrescreve,
});

describe("conferirItens (RN04)", () => {
  it("não sinaliza divergência quando tudo bate", () => {
    const [resultado] = conferirItens(CNPJ_CLIENTE, [itemNFe()], [pendencia()]);
    expect(resultado.pendencia).not.toBeNull();
    expect(resultado.divergencias).toEqual([]);
  });

  it("sinaliza item não encontrado quando a referência não existe no cliente", () => {
    const [resultado] = conferirItens(CNPJ_CLIENTE, [itemNFe({ referencia: "REF-X" })], [pendencia()]);
    expect(resultado.pendencia).toBeNull();
    expect(resultado.divergencias).toHaveLength(1);
  });

  it("sinaliza item não encontrado quando o CNPJ do destinatário não bate", () => {
    const [resultado] = conferirItens("00000000000000", [itemNFe()], [pendencia()]);
    expect(resultado.pendencia).toBeNull();
  });

  it("sinaliza divergência de valor unitário sem impedir o match", () => {
    const [resultado] = conferirItens(CNPJ_CLIENTE, [itemNFe({ valorUnitario: 30 })], [pendencia()]);
    expect(resultado.pendencia).not.toBeNull();
    expect(resultado.divergencias.some((d) => d.includes("Valor unitário"))).toBe(true);
  });

  it("sinaliza divergência quando a quantidade faturada excede a pendente (RN06 é o caminho normal, não isto)", () => {
    const [resultado] = conferirItens(CNPJ_CLIENTE, [itemNFe({ quantidade: 15 })], [pendencia({ quantidadePendente: 10 })]);
    expect(resultado.divergencias.some((d) => d.includes("Quantidade"))).toBe(true);
  });

  it("não sinaliza divergência quando a quantidade faturada é menor que a pendente (faturamento parcial normal)", () => {
    const [resultado] = conferirItens(CNPJ_CLIENTE, [itemNFe({ quantidade: 4 })], [pendencia({ quantidadePendente: 10 })]);
    expect(resultado.divergencias).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domain/nfe/__tests__/conferencia.test.ts`
Expected: FAIL — `Cannot find module '../conferencia'`

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/domain/nfe/conferencia.ts
import type { ItemNFe } from "./parser";

export type PendenciaItem = {
  itemPedidoId: string;
  pedidoId: string;
  clienteCnpj: string;
  referencia: string;
  quantidadePendente: number;
  valorUnitario: number;
};

export type ResultadoConferenciaItem = {
  itemNFe: ItemNFe;
  pendencia: PendenciaItem | null;
  divergencias: string[];
};

// RN04: casamento por CNPJ do destinatário + referência. Quantidade e valor unitário
// divergentes viram alertas na tela de conferência, mas não bloqueiam o match — quem
// decide se a baixa segue é o operador (RF15).
export function conferirItens(
  destinatarioCnpj: string,
  itensNFe: ItemNFe[],
  pendencias: PendenciaItem[],
): ResultadoConferenciaItem[] {
  const pendenciasDoCliente = pendencias.filter((p) => p.clienteCnpj === destinatarioCnpj);

  return itensNFe.map((itemNFe) => {
    const pendencia = pendenciasDoCliente.find((p) => p.referencia === itemNFe.referencia) ?? null;
    const divergencias: string[] = [];

    if (!pendencia) {
      divergencias.push("Item não encontrado em nenhum pedido pendente deste cliente.");
      return { itemNFe, pendencia, divergencias };
    }

    if (itemNFe.valorUnitario !== pendencia.valorUnitario) {
      divergencias.push(
        `Valor unitário diverge: NFe R$ ${itemNFe.valorUnitario.toFixed(2)} × pedido R$ ${pendencia.valorUnitario.toFixed(2)}.`,
      );
    }
    if (itemNFe.quantidade > pendencia.quantidadePendente) {
      divergencias.push(
        `Quantidade faturada (${itemNFe.quantidade}) maior que a pendente (${pendencia.quantidadePendente}).`,
      );
    }

    return { itemNFe, pendencia, divergencias };
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/domain/nfe/__tests__/conferencia.test.ts`
Expected: PASS (6 testes)

- [ ] **Step 5: Commit**

```bash
git add src/domain/nfe/conferencia.ts src/domain/nfe/__tests__/conferencia.test.ts
git commit -m "feat: conferência item a item da NFe (RF13/RN04)"
```

---

### Task 3: Baixa progressiva

**Files:**
- Create: `src/domain/nfe/baixa.ts`
- Test: `src/domain/nfe/__tests__/baixa.test.ts`

**Interfaces:**
- Consumes: `StatusItemPedido` de `src/domain/pedido/estado.ts` (Épico 3)
- Produces: `type ItemParaBaixa = { quantidadePedida: number; quantidadeFaturada: number; status: StatusItemPedido }`
- Produces: `type ResultadoBaixa = { quantidadeFaturada: number; status: StatusItemPedido }`
- Produces: `function aplicarBaixaItem(item: ItemParaBaixa, quantidadeNestaBaixa: number): ResultadoBaixa`

- [ ] **Step 1: Write the failing test**

```typescript
// src/domain/nfe/__tests__/baixa.test.ts
import { describe, it, expect } from "vitest";
import { aplicarBaixaItem } from "../baixa";

describe("aplicarBaixaItem (RF09/RN11)", () => {
  it("marca OK quando a baixa completa a quantidade pedida", () => {
    const resultado = aplicarBaixaItem(
      { quantidadePedida: 10, quantidadeFaturada: 0, status: "PENDENTE" },
      10,
    );
    expect(resultado).toEqual({ quantidadeFaturada: 10, status: "OK" });
  });

  it("mantém PENDENTE quando a baixa é parcial", () => {
    const resultado = aplicarBaixaItem(
      { quantidadePedida: 10, quantidadeFaturada: 0, status: "PENDENTE" },
      4,
    );
    expect(resultado).toEqual({ quantidadeFaturada: 4, status: "PENDENTE" });
  });

  it("soma progressivamente quando já havia faturamento anterior de outra NFe", () => {
    const primeira = aplicarBaixaItem(
      { quantidadePedida: 10, quantidadeFaturada: 0, status: "PENDENTE" },
      4,
    );
    const segunda = aplicarBaixaItem(
      { quantidadePedida: 10, quantidadeFaturada: primeira.quantidadeFaturada, status: primeira.status },
      6,
    );
    expect(segunda).toEqual({ quantidadeFaturada: 10, status: "OK" });
  });

  it("não altera o status de item já resolvido por FORA_DE_FABRICACAO (ADR-005)", () => {
    const resultado = aplicarBaixaItem(
      { quantidadePedida: 10, quantidadeFaturada: 6, status: "FORA_DE_FABRICACAO" },
      2,
    );
    expect(resultado).toEqual({ quantidadeFaturada: 8, status: "FORA_DE_FABRICACAO" });
  });

  it("não altera o status de item já resolvido por DESISTENCIA (ADR-005)", () => {
    const resultado = aplicarBaixaItem(
      { quantidadePedida: 10, quantidadeFaturada: 0, status: "DESISTENCIA" },
      10,
    );
    expect(resultado).toEqual({ quantidadeFaturada: 10, status: "DESISTENCIA" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domain/nfe/__tests__/baixa.test.ts`
Expected: FAIL — `Cannot find module '../baixa'`

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/domain/nfe/baixa.ts
import type { StatusItemPedido } from "../pedido/estado";

export type ItemParaBaixa = {
  quantidadePedida: number;
  quantidadeFaturada: number;
  status: StatusItemPedido;
};

export type ResultadoBaixa = {
  quantidadeFaturada: number;
  status: StatusItemPedido;
};

// RF09/RN11: cada baixa soma à quantidade já faturada (baixa parcial progressiva por
// várias NFes). ADR-005: item já resolvido por não-faturamento não volta a mudar de
// status ao receber uma baixa (mas a quantidade é registrada para histórico).
export function aplicarBaixaItem(item: ItemParaBaixa, quantidadeNestaBaixa: number): ResultadoBaixa {
  const quantidadeFaturada = item.quantidadeFaturada + quantidadeNestaBaixa;

  if (item.status === "FORA_DE_FABRICACAO" || item.status === "DESISTENCIA") {
    return { quantidadeFaturada, status: item.status };
  }

  const status: StatusItemPedido = quantidadeFaturada >= item.quantidadePedida ? "OK" : "PENDENTE";
  return { quantidadeFaturada, status };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/domain/nfe/__tests__/baixa.test.ts`
Expected: PASS (5 testes)

- [ ] **Step 5: Commit**

```bash
git add src/domain/nfe/baixa.ts src/domain/nfe/__tests__/baixa.test.ts
git commit -m "feat: baixa parcial progressiva de item (RF09/RN11)"
```

---

### Task 4: Vínculo de NFe a vários pedidos do mesmo cliente

**Files:**
- Create: `src/domain/nfe/vinculo.ts`
- Test: `src/domain/nfe/__tests__/vinculo.test.ts`

**Interfaces:**
- Produces: `type PedidoParaVinculo = { id: string; clienteId: string }`
- Produces: `function validarVinculoPedidos(pedidos: PedidoParaVinculo[]): string[]`

- [ ] **Step 1: Write the failing test**

```typescript
// src/domain/nfe/__tests__/vinculo.test.ts
import { describe, it, expect } from "vitest";
import { validarVinculoPedidos } from "../vinculo";

describe("validarVinculoPedidos (RN10)", () => {
  it("rejeita lista vazia", () => {
    expect(validarVinculoPedidos([])).toHaveLength(1);
  });

  it("aceita um único pedido", () => {
    expect(validarVinculoPedidos([{ id: "p1", clienteId: "c1" }])).toEqual([]);
  });

  it("aceita vários pedidos do mesmo cliente", () => {
    const erros = validarVinculoPedidos([
      { id: "p1", clienteId: "c1" },
      { id: "p2", clienteId: "c1" },
    ]);
    expect(erros).toEqual([]);
  });

  it("rejeita pedidos de clientes diferentes", () => {
    const erros = validarVinculoPedidos([
      { id: "p1", clienteId: "c1" },
      { id: "p2", clienteId: "c2" },
    ]);
    expect(erros).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domain/nfe/__tests__/vinculo.test.ts`
Expected: FAIL — `Cannot find module '../vinculo'`

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/domain/nfe/vinculo.ts
export type PedidoParaVinculo = {
  id: string;
  clienteId: string;
};

// RN10: uma NFe pode cobrir itens de vários pedidos, desde que todos sejam do mesmo
// cliente. O CNPJ do destinatário já foi conferido em conferirItens (RN04); aqui só
// garantimos que os pedidos efetivamente vinculados não misturam clientes.
export function validarVinculoPedidos(pedidos: PedidoParaVinculo[]): string[] {
  if (pedidos.length === 0) {
    return ["Selecione ao menos um pedido para vincular à NFe."];
  }

  const clientesDistintos = new Set(pedidos.map((p) => p.clienteId));
  if (clientesDistintos.size > 1) {
    return ["Todos os pedidos vinculados a uma NFe devem ser do mesmo cliente."];
  }

  return [];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/domain/nfe/__tests__/vinculo.test.ts`
Expected: PASS (4 testes)

- [ ] **Step 5: Commit**

```bash
git add src/domain/nfe/vinculo.ts src/domain/nfe/__tests__/vinculo.test.ts
git commit -m "feat: validação de vínculo NFe-pedidos do mesmo cliente (RN10)"
```

---

### Task 5: Schema Prisma — NotaFiscal, NotaFiscalPedido, ItemFaturado

**Files:**
- Modify: `prisma/schema.prisma`
- Test: `src/lib/__tests__/nfe-schema.test.ts`

**Interfaces:**
- Produces (Prisma models usados pelas próximas tarefas): `NotaFiscal { id, numero, chaveAcesso, emitenteCnpj, destinatarioCnpj, dataEmissao, totalProdutos, totalNota, status, pedidos, itensFaturados }`, `NotaFiscalPedido { id, notaFiscalId, pedidoId }`, `ItemFaturado { id, itemPedidoId, notaFiscalId, quantidadeFaturada }`.

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/__tests__/nfe-schema.test.ts
import { describe, it, expect } from "vitest";
import { prisma } from "../prisma";

describe("schema de NFe", () => {
  it("cria NotaFiscal vinculada a um pedido, com item faturado, e lê de volta", async () => {
    const fabrica = await prisma.fabrica.create({
      data: { nome: "Fábrica Teste NFe", cnpj: "11444777000246" },
    });
    const cliente = await prisma.cliente.create({
      data: { cnpj: "11222333000262", nomeFantasia: "Cliente Teste NFe" },
    });
    const pedido = await prisma.pedido.create({
      data: {
        numero: "PED-NFE-1",
        origem: "MANUAL",
        fabricaId: fabrica.id,
        clienteId: cliente.id,
        itens: {
          create: [
            { referencia: "REF-1", descricao: "Peça 1", quantidadePedida: 10, valorUnitario: 25.5 },
          ],
        },
      },
      include: { itens: true },
    });
    const item = pedido.itens[0];

    const notaFiscal = await prisma.notaFiscal.create({
      data: {
        numero: "1234",
        chaveAcesso: "35260711444777000161550010000012341123456789",
        emitenteCnpj: fabrica.cnpj,
        destinatarioCnpj: cliente.cnpj,
        dataEmissao: new Date("2026-07-01T10:00:00-03:00"),
        totalProdutos: 255,
        totalNota: 260,
        pedidos: { create: [{ pedidoId: pedido.id }] },
        itensFaturados: { create: [{ itemPedidoId: item.id, quantidadeFaturada: 10 }] },
      },
    });

    const lida = await prisma.notaFiscal.findUnique({
      where: { id: notaFiscal.id },
      include: { pedidos: true, itensFaturados: true },
    });

    expect(lida?.status).toBe("TRANSITO");
    expect(lida?.pedidos).toHaveLength(1);
    expect(lida?.pedidos[0].pedidoId).toBe(pedido.id);
    expect(lida?.itensFaturados).toHaveLength(1);
    expect(lida?.itensFaturados[0].quantidadeFaturada).toBe(10);

    await prisma.itemFaturado.deleteMany({ where: { notaFiscalId: notaFiscal.id } });
    await prisma.notaFiscalPedido.deleteMany({ where: { notaFiscalId: notaFiscal.id } });
    await prisma.notaFiscal.delete({ where: { id: notaFiscal.id } });
    await prisma.itemPedido.deleteMany({ where: { pedidoId: pedido.id } });
    await prisma.pedido.delete({ where: { id: pedido.id } });
    await prisma.cliente.delete({ where: { id: cliente.id } });
    await prisma.fabrica.delete({ where: { id: fabrica.id } });
  }, 15000);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/nfe-schema.test.ts`
Expected: FAIL — `Property 'notaFiscal' does not exist` (o model ainda não existe no Prisma Client)

- [ ] **Step 3: Adicionar os models ao schema**

Adicione ao final de `prisma/schema.prisma` o enum de status de rastreio e os três
models novos, e as relações inversas em `Pedido`/`ItemPedido`:

```prisma
enum StatusRastreio {
  TRANSITO
  RECEBIDA
  ARMAZENADA
  EXTRAVIADO
}

model NotaFiscal {
  id               String             @id @default(cuid())
  numero           String
  chaveAcesso      String             @unique
  emitenteCnpj     String
  destinatarioCnpj String
  dataEmissao      DateTime
  totalProdutos    Decimal            @db.Decimal(12, 2)
  totalNota        Decimal            @db.Decimal(12, 2)
  status           StatusRastreio     @default(TRANSITO)
  criadoEm         DateTime           @default(now())
  pedidos          NotaFiscalPedido[]
  itensFaturados   ItemFaturado[]
}

model NotaFiscalPedido {
  id           String     @id @default(cuid())
  notaFiscalId String
  pedidoId     String
  notaFiscal   NotaFiscal @relation(fields: [notaFiscalId], references: [id])
  pedido       Pedido     @relation(fields: [pedidoId], references: [id])

  @@unique([notaFiscalId, pedidoId])
}

model ItemFaturado {
  id                 String     @id @default(cuid())
  itemPedidoId       String
  notaFiscalId       String
  quantidadeFaturada Int
  criadoEm           DateTime   @default(now())
  itemPedido         ItemPedido @relation(fields: [itemPedidoId], references: [id])
  notaFiscal         NotaFiscal @relation(fields: [notaFiscalId], references: [id])
}
```

Em seguida, edite os models já existentes para adicionar as relações inversas:

```prisma
model Pedido {
  id        String             @id @default(cuid())
  numero    String?
  semNumero Boolean            @default(false)
  origem    OrigemPedido
  estado    EstadoPedido       @default(SEM_NFE)
  fabricaId String
  clienteId String
  fabrica   Fabrica            @relation(fields: [fabricaId], references: [id])
  cliente   Cliente            @relation(fields: [clienteId], references: [id])
  itens     ItemPedido[]
  notasFiscais NotaFiscalPedido[]
  criadoEm  DateTime           @default(now())
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
  itensFaturados       ItemFaturado[]
  criadoEm             DateTime         @default(now())
}
```

- [ ] **Step 4: Gerar e aplicar a migração**

Run: `npx prisma migrate dev --name conferencia_nfe`
Expected: migração criada em `prisma/migrations/` e aplicada sem erro

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/nfe-schema.test.ts`
Expected: PASS (1 teste)

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations src/lib/__tests__/nfe-schema.test.ts
git commit -m "feat: schema de NotaFiscal/NotaFiscalPedido/ItemFaturado (RF14/RF09)"
```

---

### Task 6: API de pendências por fábrica+cliente

**Files:**
- Create: `src/app/api/pedidos/pendentes/route.ts`

**Interfaces:**
- Consumes: `calcularQtdPendente` de `src/domain/pedido/item.ts` (Épico 3)
- Produces: `GET /api/pedidos/pendentes?fabricaId=...&clienteId=...` → `PendenciaItem[]` (mesmo formato de `src/domain/nfe/conferencia.ts`, Task 2) mais `pedidoNumero: string`.

> Segue a mesma convenção de `src/app/api/fabricas/route.ts` e
> `src/app/api/clientes/route.ts`: rota fina, sem lógica de negócio própria, sem teste
> dedicado (a regra que importa — `calcularQtdPendente` — já tem teste no Épico 3).

- [ ] **Step 1: Implementar a rota**

```typescript
// src/app/api/pedidos/pendentes/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calcularQtdPendente } from "@/domain/pedido/item";

export async function GET(request: NextRequest) {
  const fabricaId = request.nextUrl.searchParams.get("fabricaId");
  const clienteId = request.nextUrl.searchParams.get("clienteId");
  if (!fabricaId || !clienteId) return NextResponse.json([]);

  const cliente = await prisma.cliente.findUnique({ where: { id: clienteId } });
  if (!cliente) return NextResponse.json([]);

  const pedidos = await prisma.pedido.findMany({
    where: { fabricaId, clienteId, estado: { in: ["SEM_NFE", "PARCIAL"] } },
    include: { itens: { where: { status: "PENDENTE" } } },
  });

  const pendencias = pedidos.flatMap((pedido) =>
    pedido.itens.map((item) => ({
      itemPedidoId: item.id,
      pedidoId: pedido.id,
      pedidoNumero: pedido.semNumero ? "S/N" : (pedido.numero ?? "S/N"),
      clienteCnpj: cliente.cnpj,
      referencia: item.referencia,
      quantidadePendente: calcularQtdPendente({
        quantidadePedida: item.quantidadePedida,
        quantidadeFaturada: item.quantidadeFaturada,
      }),
      valorUnitario: Number(item.valorUnitario),
    })),
  );

  return NextResponse.json(pendencias);
}
```

- [ ] **Step 2: Verificar manualmente**

Run: `npm run dev` e, em outro terminal, `curl "http://localhost:3000/api/pedidos/pendentes?fabricaId=X&clienteId=Y"` com IDs reais do seed
Expected: JSON com a lista de pendências (ou `[]` se não houver pedidos em aberto)

- [ ] **Step 3: Commit**

```bash
git add src/app/api/pedidos/pendentes/route.ts
git commit -m "feat: rota de pendências por fábrica e cliente para a conferência de NFe"
```

---

### Task 7: Tela de conferência — upload, comparação e confirmação da baixa

**Files:**
- Create: `src/app/(app)/conferencia/actions.ts`
- Create: `src/app/(app)/conferencia/page.tsx`

**Interfaces:**
- Consumes: `extrairNFeDoXml` (Task 1), `conferirItens`/`PendenciaItem`/`ResultadoConferenciaItem` (Task 2), `validarVinculoPedidos` (Task 4), `aplicarBaixaItem` (Task 3), `calcularQtdPendente` (Épico 3), `recalcularEstado` (Épico 3), `compararCampos`/`registrarAlteracoes` (Épico 2), `obterUsuarioLogado` (Épico 2).
- Produces: `type AnaliseNFe = { nfe: NFeExtraida; clienteId: string | null; fabricaId: string | null; conferencia: ResultadoConferenciaItem[] }`, `analisarXmlNFe(formData): Promise<{ erro?: string; analise?: AnaliseNFe }>`, `confirmarBaixaNFe(analise: AnaliseNFe): Promise<{ erros: string[] }>`.

- [ ] **Step 1: Implementar as server actions**

```typescript
// src/app/(app)/conferencia/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { obterUsuarioLogado } from "@/lib/sessao";
import { extrairNFeDoXml, type NFeExtraida } from "@/domain/nfe/parser";
import { conferirItens, type PendenciaItem, type ResultadoConferenciaItem } from "@/domain/nfe/conferencia";
import { validarVinculoPedidos } from "@/domain/nfe/vinculo";
import { aplicarBaixaItem } from "@/domain/nfe/baixa";
import { calcularQtdPendente } from "@/domain/pedido/item";
import { recalcularEstado } from "@/domain/pedido/estado";
import { compararCampos } from "@/domain/auditoria/evento";
import { registrarAlteracoes } from "@/lib/auditoria";

export type AnaliseNFe = {
  nfe: NFeExtraida;
  clienteId: string | null;
  fabricaId: string | null;
  conferencia: ResultadoConferenciaItem[];
};

export async function analisarXmlNFe(formData: FormData): Promise<{ erro?: string; analise?: AnaliseNFe }> {
  const arquivo = formData.get("arquivo") as File | null;
  if (!arquivo || arquivo.size === 0) return { erro: "Selecione um arquivo XML." };

  let nfe: NFeExtraida;
  try {
    nfe = extrairNFeDoXml(await arquivo.text());
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : "Falha ao ler o XML." };
  }

  const existente = await prisma.notaFiscal.findUnique({ where: { chaveAcesso: nfe.chaveAcesso } });
  if (existente) return { erro: "Esta NFe já foi importada." };

  const [cliente, fabrica] = await Promise.all([
    prisma.cliente.findUnique({ where: { cnpj: nfe.destinatarioCnpj } }),
    prisma.fabrica.findUnique({ where: { cnpj: nfe.emitenteCnpj } }),
  ]);

  if (!cliente || !fabrica) {
    return { analise: { nfe, clienteId: cliente?.id ?? null, fabricaId: fabrica?.id ?? null, conferencia: [] } };
  }

  const pedidos = await prisma.pedido.findMany({
    where: { clienteId: cliente.id, fabricaId: fabrica.id, estado: { in: ["SEM_NFE", "PARCIAL"] } },
    include: { itens: { where: { status: "PENDENTE" } } },
  });

  const pendencias: PendenciaItem[] = pedidos.flatMap((pedido) =>
    pedido.itens.map((item) => ({
      itemPedidoId: item.id,
      pedidoId: pedido.id,
      clienteCnpj: cliente.cnpj,
      referencia: item.referencia,
      quantidadePendente: calcularQtdPendente({
        quantidadePedida: item.quantidadePedida,
        quantidadeFaturada: item.quantidadeFaturada,
      }),
      valorUnitario: Number(item.valorUnitario),
    })),
  );

  const conferencia = conferirItens(nfe.destinatarioCnpj, nfe.itens, pendencias);

  return { analise: { nfe, clienteId: cliente.id, fabricaId: fabrica.id, conferencia } };
}

export async function confirmarBaixaNFe(analise: AnaliseNFe): Promise<{ erros: string[] }> {
  const usuario = await obterUsuarioLogado();
  if (!usuario) return { erros: ["Sessão expirada. Faça login novamente."] };
  if (!analise.clienteId || !analise.fabricaId) {
    return { erros: ["Fábrica ou cliente não cadastrado para esta NFe."] };
  }

  const vinculados = analise.conferencia.filter((r) => r.pendencia !== null);
  if (vinculados.length === 0) return { erros: ["Nenhum item da NFe corresponde a um pedido pendente."] };

  const pedidosIds = [...new Set(vinculados.map((r) => r.pendencia!.pedidoId))];
  const erros = validarVinculoPedidos(pedidosIds.map((id) => ({ id, clienteId: analise.clienteId! })));
  if (erros.length > 0) return { erros };

  const notaFiscal = await prisma.notaFiscal.create({
    data: {
      numero: analise.nfe.numero,
      chaveAcesso: analise.nfe.chaveAcesso,
      emitenteCnpj: analise.nfe.emitenteCnpj,
      destinatarioCnpj: analise.nfe.destinatarioCnpj,
      dataEmissao: new Date(analise.nfe.dataEmissao),
      totalProdutos: analise.nfe.totalProdutos,
      totalNota: analise.nfe.totalNota,
      pedidos: { create: pedidosIds.map((pedidoId) => ({ pedidoId })) },
    },
  });

  for (const resultado of vinculados) {
    const pendencia = resultado.pendencia!;
    const item = await prisma.itemPedido.findUnique({ where: { id: pendencia.itemPedidoId } });
    if (!item) continue;

    const { quantidadeFaturada, status } = aplicarBaixaItem(item, resultado.itemNFe.quantidade);

    await prisma.itemFaturado.create({
      data: { itemPedidoId: item.id, notaFiscalId: notaFiscal.id, quantidadeFaturada: resultado.itemNFe.quantidade },
    });
    await prisma.itemPedido.update({ where: { id: item.id }, data: { quantidadeFaturada, status } });
    await registrarAlteracoes(
      compararCampos(
        "ItemPedido",
        item.id,
        usuario.id,
        { quantidadeFaturada: item.quantidadeFaturada, status: item.status },
        { quantidadeFaturada, status },
      ),
    );
  }

  for (const pedidoId of pedidosIds) {
    const pedido = await prisma.pedido.findUnique({ where: { id: pedidoId }, include: { itens: true } });
    if (!pedido) continue;

    // ADR-008: o pedido só sai de SEM_NFE quando a 1ª NFe é vinculada. A partir daí,
    // recalcularEstado decide entre PARCIAL/COMPLETO olhando só os itens (ADR-005).
    const baseParaRecalculo = pedido.estado === "SEM_NFE" ? "PARCIAL" : pedido.estado;
    const novoEstado = recalcularEstado(baseParaRecalculo, pedido.itens);

    if (novoEstado !== pedido.estado) {
      await prisma.pedido.update({ where: { id: pedidoId }, data: { estado: novoEstado } });
      await registrarAlteracoes(
        compararCampos("Pedido", pedidoId, usuario.id, { estado: pedido.estado }, { estado: novoEstado }),
      );
    }
    revalidatePath(`/pedidos/${pedidoId}`);
  }

  await registrarAlteracoes(
    compararCampos(
      "NotaFiscal",
      notaFiscal.id,
      usuario.id,
      {},
      { chaveAcesso: notaFiscal.chaveAcesso, numero: notaFiscal.numero },
    ),
  );

  revalidatePath("/pedidos");
  return { erros: [] };
}
```

- [ ] **Step 2: Implementar a tela**

```tsx
// src/app/(app)/conferencia/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { analisarXmlNFe, confirmarBaixaNFe, type AnaliseNFe } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function ConferenciaNFePage() {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [analise, setAnalise] = useState<AnaliseNFe | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function handleAnalisar(formData: FormData) {
    setErro(null);
    setAnalise(null);
    const resultado = await analisarXmlNFe(formData);
    if (resultado.erro) {
      setErro(resultado.erro);
      return;
    }
    setAnalise(resultado.analise ?? null);
  }

  async function handleConfirmar() {
    if (!analise) return;
    setEnviando(true);
    const resultado = await confirmarBaixaNFe(analise);
    setEnviando(false);
    if (resultado.erros.length > 0) {
      setErro(resultado.erros.join(" "));
      return;
    }
    router.push("/pedidos");
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Conferência de NFe</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={handleAnalisar} className="flex items-end gap-2">
            <Input type="file" name="arquivo" accept=".xml" required />
            <Button type="submit">Analisar</Button>
          </form>
          {erro && <p className="mt-2 text-sm text-destructive">{erro}</p>}
        </CardContent>
      </Card>

      {analise && (
        <Card>
          <CardHeader>
            <CardTitle>
              NFe {analise.nfe.numero} · destinatário {analise.nfe.destinatarioCnpj}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {(!analise.clienteId || !analise.fabricaId) && (
              <p className="text-sm text-destructive">
                Fábrica ou cliente desta NFe não está cadastrado no sistema.
              </p>
            )}

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Referência</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Qtd. NFe</TableHead>
                  <TableHead>Valor unit.</TableHead>
                  <TableHead>Divergências</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analise.conferencia.map((resultado) => (
                  <TableRow key={resultado.itemNFe.referencia}>
                    <TableCell>{resultado.itemNFe.referencia}</TableCell>
                    <TableCell>{resultado.itemNFe.descricao}</TableCell>
                    <TableCell>{resultado.itemNFe.quantidade}</TableCell>
                    <TableCell>R$ {resultado.itemNFe.valorUnitario.toFixed(2)}</TableCell>
                    <TableCell>
                      {resultado.divergencias.length === 0 ? (
                        <Badge variant="outline">OK</Badge>
                      ) : (
                        resultado.divergencias.map((d) => (
                          <p key={d} className="text-sm text-destructive">
                            {d}
                          </p>
                        ))
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <Button onClick={handleConfirmar} disabled={enviando || !analise.clienteId || !analise.fabricaId}>
              Confirmar baixa
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Rodar a suíte completa**

Run: `npm test`
Expected: PASS (todos os testes existentes continuam verdes)

- [ ] **Step 4: Verificar manualmente no navegador**

Run: `npm run dev`, abrir `http://localhost:3000/conferencia`, logar, subir um XML de NFe
de teste (pode reusar o XML do Step 2 da Task 1 salvo em arquivo) e conferir que a
grade aparece com divergências corretas e que "Confirmar baixa" atualiza o pedido.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/conferencia/actions.ts" "src/app/(app)/conferencia/page.tsx"
git commit -m "feat: tela de conferência de NFe com confirmação de baixa (RF15/RF16)"
```

---

### Task 8: Notas fiscais no detalhe do pedido + relatório de cruzamento (RF17)

**Files:**
- Create: `src/domain/nfe/relatorio.ts`
- Test: `src/domain/nfe/__tests__/relatorio.test.ts`
- Create: `src/app/(app)/conferencia/[id]/page.tsx`
- Modify: `src/app/(app)/pedidos/[id]/page.tsx` (aba "Notas fiscais")

**Interfaces:**
- Produces: `type LinhaFaturamento = { pedidoId: string; pedidoNumero: string; referencia: string; descricao: string; quantidadeFaturada: number; valorUnitario: number }`
- Produces: `type GrupoPedidoFaturamento = { pedidoId: string; pedidoNumero: string; linhas: LinhaFaturamento[]; totalFaturado: number }`
- Produces: `function agruparCruzamentoPorPedido(linhas: LinhaFaturamento[]): GrupoPedidoFaturamento[]`

- [ ] **Step 1: Write the failing test**

```typescript
// src/domain/nfe/__tests__/relatorio.test.ts
import { describe, it, expect } from "vitest";
import { agruparCruzamentoPorPedido, type LinhaFaturamento } from "../relatorio";

const linha = (sobrescreve: Partial<LinhaFaturamento> = {}): LinhaFaturamento => ({
  pedidoId: "p1",
  pedidoNumero: "PED-1",
  referencia: "REF-1",
  descricao: "Peça 1",
  quantidadeFaturada: 2,
  valorUnitario: 10,
  ...sobrescreve,
});

describe("agruparCruzamentoPorPedido (RF17)", () => {
  it("agrupa linhas de um único pedido e soma o total faturado", () => {
    const grupos = agruparCruzamentoPorPedido([
      linha({ quantidadeFaturada: 2, valorUnitario: 10 }),
      linha({ referencia: "REF-2", quantidadeFaturada: 3, valorUnitario: 5 }),
    ]);

    expect(grupos).toHaveLength(1);
    expect(grupos[0].linhas).toHaveLength(2);
    expect(grupos[0].totalFaturado).toBe(2 * 10 + 3 * 5);
  });

  it("separa por pedido quando a NFe cobre vários pedidos (RN10)", () => {
    const grupos = agruparCruzamentoPorPedido([
      linha({ pedidoId: "p1", pedidoNumero: "PED-1" }),
      linha({ pedidoId: "p2", pedidoNumero: "PED-2" }),
    ]);

    expect(grupos.map((g) => g.pedidoId).sort()).toEqual(["p1", "p2"]);
  });

  it("retorna lista vazia para nenhuma linha", () => {
    expect(agruparCruzamentoPorPedido([])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domain/nfe/__tests__/relatorio.test.ts`
Expected: FAIL — `Cannot find module '../relatorio'`

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/domain/nfe/relatorio.ts
export type LinhaFaturamento = {
  pedidoId: string;
  pedidoNumero: string;
  referencia: string;
  descricao: string;
  quantidadeFaturada: number;
  valorUnitario: number;
};

export type GrupoPedidoFaturamento = {
  pedidoId: string;
  pedidoNumero: string;
  linhas: LinhaFaturamento[];
  totalFaturado: number;
};

// RF17: substitui a aba manual "CRUZAMENTO NF" — agrupa o que uma NFe faturou por
// pedido (uma NFe pode cobrir vários pedidos do mesmo cliente, RN10).
export function agruparCruzamentoPorPedido(linhas: LinhaFaturamento[]): GrupoPedidoFaturamento[] {
  const grupos = new Map<string, GrupoPedidoFaturamento>();

  for (const linha of linhas) {
    if (!grupos.has(linha.pedidoId)) {
      grupos.set(linha.pedidoId, {
        pedidoId: linha.pedidoId,
        pedidoNumero: linha.pedidoNumero,
        linhas: [],
        totalFaturado: 0,
      });
    }
    const grupo = grupos.get(linha.pedidoId)!;
    grupo.linhas.push(linha);
    grupo.totalFaturado += linha.quantidadeFaturada * linha.valorUnitario;
  }

  return [...grupos.values()];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/domain/nfe/__tests__/relatorio.test.ts`
Expected: PASS (3 testes)

- [ ] **Step 5: Criar a tela de relatório de cruzamento**

```tsx
// src/app/(app)/conferencia/[id]/page.tsx
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { agruparCruzamentoPorPedido, type LinhaFaturamento } from "@/domain/nfe/relatorio";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function RelatorioCruzamentoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const notaFiscal = await prisma.notaFiscal.findUnique({
    where: { id },
    include: { itensFaturados: { include: { itemPedido: { include: { pedido: true } } } } },
  });
  if (!notaFiscal) notFound();

  const linhas: LinhaFaturamento[] = notaFiscal.itensFaturados.map((faturado) => ({
    pedidoId: faturado.itemPedido.pedidoId,
    pedidoNumero: faturado.itemPedido.pedido.semNumero
      ? "S/N"
      : (faturado.itemPedido.pedido.numero ?? "S/N"),
    referencia: faturado.itemPedido.referencia,
    descricao: faturado.itemPedido.descricao,
    quantidadeFaturada: faturado.quantidadeFaturada,
    valorUnitario: Number(faturado.itemPedido.valorUnitario),
  }));

  const grupos = agruparCruzamentoPorPedido(linhas);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Cruzamento — NFe {notaFiscal.numero}</CardTitle>
          <p className="text-sm text-muted-foreground">Chave: {notaFiscal.chaveAcesso}</p>
        </CardHeader>
      </Card>

      {grupos.map((grupo) => (
        <Card key={grupo.pedidoId}>
          <CardHeader>
            <CardTitle className="text-base">Pedido {grupo.pedidoNumero}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Referência</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Qtd. faturada</TableHead>
                  <TableHead>Valor unit.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {grupo.linhas.map((linha) => (
                  <TableRow key={`${linha.pedidoId}-${linha.referencia}`}>
                    <TableCell>{linha.referencia}</TableCell>
                    <TableCell>{linha.descricao}</TableCell>
                    <TableCell>{linha.quantidadeFaturada}</TableCell>
                    <TableCell>R$ {linha.valorUnitario.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="mt-2 text-sm text-muted-foreground">
              Total faturado neste pedido: R$ {grupo.totalFaturado.toFixed(2)}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

- [ ] **Step 6: Atualizar a aba "Notas fiscais" do detalhe do pedido**

Em `src/app/(app)/pedidos/[id]/page.tsx`, adicione o import de `Link` e a busca das
NFes vinculadas, e troque o conteúdo da aba `notas`:

```typescript
import Link from "next/link";
```

Logo após a busca de `eventos` (antes do `return`):

```typescript
  const notasFiscais = await prisma.notaFiscalPedido.findMany({
    where: { pedidoId: pedido.id },
    include: { notaFiscal: true },
    orderBy: { notaFiscal: { criadoEm: "desc" } },
  });
```

Substitua o conteúdo de `<TabsContent value="notas">`:

```tsx
        <TabsContent value="notas">
          {notasFiscais.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma NFe vinculada ainda.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Chave de acesso</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Cruzamento</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {notasFiscais.map(({ notaFiscal }) => (
                  <TableRow key={notaFiscal.id}>
                    <TableCell>{notaFiscal.numero}</TableCell>
                    <TableCell>{notaFiscal.chaveAcesso}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{notaFiscal.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <Link href={`/conferencia/${notaFiscal.id}`} className="underline">
                        Ver cruzamento
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>
```

- [ ] **Step 7: Rodar a suíte completa**

Run: `npm test`
Expected: PASS (todos os testes)

- [ ] **Step 8: Verificar manualmente no navegador**

Run: `npm run dev`. Após confirmar uma baixa na tela de conferência (Task 7), abrir o
pedido correspondente, ir na aba "Notas fiscais", conferir que a NFe aparece, clicar em
"Ver cruzamento" e conferir que a tela `/conferencia/[id]` mostra os itens agrupados
por pedido com o total faturado.

- [ ] **Step 9: Commit**

```bash
git add src/domain/nfe/relatorio.ts src/domain/nfe/__tests__/relatorio.test.ts "src/app/(app)/conferencia/[id]/page.tsx" "src/app/(app)/pedidos/[id]/page.tsx"
git commit -m "feat: relatório de cruzamento por NFe e aba de notas fiscais no pedido (RF17)"
```

---

## Self-Review

**Cobertura da spec:**
- RF12 (parser XML) → Task 1. RF13/RN04 (conferência) → Task 2. RF09/RN11 (baixa
  progressiva) → Task 3. RF14/RN10 (NFe cobre vários pedidos) → Tasks 4, 5, 7. RF15
  (confirmação manual da baixa) → Task 7. RF16 (tela editável e visual) → Task 7. RF17
  (relatório de cruzamento) → Task 8. ADR-008 (NFe nasce TRÂNSITO; S/NFE é do pedido)
  → schema da Task 5 e transição em Task 7. ADR-005 (item resolvido conta como
  fechado) → Task 3 e reuso de `recalcularEstado` na Task 7. Auditoria (regra de ouro
  4) → gravada em toda alteração de `ItemPedido`, `Pedido` e `NotaFiscal` na Task 7.
- Não coberto neste plano (fora do escopo do Épico 4, conforme os briefs): rastreio
  logístico da NFe além do status inicial `TRANSITO` (Épico 5) e abertura de chamado a
  partir da NFe (Épico 6).

**Placeholders:** nenhum "TBD"/"implementar depois" — todos os passos têm código
completo.

**Consistência de tipos:** `ItemNFe` (Task 1) é reusado sem alteração em `conferencia.ts`
(Task 2) e `actions.ts` (Task 7). `PendenciaItem` (Task 2) tem o mesmo formato retornado
pela rota da Task 6 e montado em `actions.ts` (Task 7). `StatusItemPedido` (Épico 3) é
reusado em `baixa.ts` (Task 3) sem redefinição. `LinhaFaturamento`/`GrupoPedidoFaturamento`
(Task 8) usados de forma consistente entre o domínio e a página que os consome.
