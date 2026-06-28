# Épico 2 — Cadastros & Acesso · Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:subagent-driven-development`
> (recommended) or `superpowers:executing-plans` to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Multi-fábrica, clientes (multi-fábrica) e usuários com perfis e permissão por
fábrica funcionando ponta a ponta; infra de auditoria pronta para uso transversal pelos
épicos seguintes (Pedidos, NFe, Rastreio, Chamados).

**Architecture:** Regras de validação e de acesso continuam como funções puras em
`src/domain/` (TDD, sem Next/Prisma/Supabase). Persistência via Prisma (`Fabrica`,
`Cliente`, `ClienteFabrica`, `Usuario`, `UsuarioFabrica`, `EventoAuditoria`). Telas em
`src/app/(app)/cadastros/...` são finas: chamam validação pura, depois Prisma, depois o
helper de auditoria. `src/lib/sessao.ts` resolve o usuário logado (Supabase Auth →
`Usuario` no Postgres) para autoria de auditoria e checagem de perfil.

**Tech Stack:** Next.js (App Router, Server Actions), TypeScript, Prisma, PostgreSQL
(Supabase), Supabase Auth, Vitest, Playwright.

## Global Constraints

- Linguagem única: **TypeScript** (strict mode, já ligado).
- Regra de negócio em **funções puras** sob `src/domain/`, sem dependência de
  Next/Prisma/Supabase — é aí que mora o TDD.
- **TDD obrigatório** para toda função pura de domínio: teste falha primeiro (RED),
  implementação mínima (GREEN), refator.
- Código de integração (telas, Server Actions, helpers de banco) não tem teste unitário
  dedicado — é verificado por e2e/manual, seguindo o padrão já usado no Épico 1
  (`rotaProtegida` testado, `middleware`/`proxy.ts` e tela de login verificados
  manualmente).
- **Auditoria de 100%**: toda criação/alteração em `Fabrica`, `Cliente`, `Usuario`
  grava `EventoAuditoria` via `registrarAlteracoes()`.
- **Conhecido:** o teste `src/lib/__tests__/prisma.test.ts` (conexão direta porta 5432
  com a Supabase) já falhava de forma intermitente antes deste épico, na branch
  `main`. Se os novos testes de persistência (Task 2 e Task 4) falharem com o mesmo
  erro de rede/timeout, **não é regressão deste plano** — relate e siga; não tente
  "corrigir" mudando lógica de domínio por causa disso.
- Custo: apenas planos gratuitos (Vercel + Supabase).

---

### Task 1: Validador de CNPJ (domínio puro)

**Files:**
- Create: `src/domain/cadastro/cnpj.ts`
- Test: `src/domain/cadastro/__tests__/cnpj.test.ts`

**Interfaces:**
- Produces:
  - `function normalizarCnpj(cnpj: string): string`
  - `function cnpjValido(cnpj: string): boolean`

- [ ] **Step 1: Escrever os testes que falham**

`src/domain/cadastro/__tests__/cnpj.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { normalizarCnpj, cnpjValido } from "../cnpj";

describe("normalizarCnpj", () => {
  it("remove pontuação e mantém só os dígitos", () => {
    expect(normalizarCnpj("11.444.777/0001-61")).toBe("11444777000161");
  });
});

describe("cnpjValido", () => {
  it("aceita CNPJ válido sem máscara", () => {
    expect(cnpjValido("11444777000161")).toBe(true);
  });

  it("aceita CNPJ válido com máscara", () => {
    expect(cnpjValido("11.444.777/0001-61")).toBe(true);
  });

  it("aceita outro CNPJ válido conhecido", () => {
    expect(cnpjValido("11.222.333/0001-81")).toBe(true);
  });

  it("rejeita dígito verificador incorreto", () => {
    expect(cnpjValido("11444777000162")).toBe(false);
  });

  it("rejeita CNPJ com todos os dígitos iguais", () => {
    expect(cnpjValido("11111111111111")).toBe(false);
  });

  it("rejeita CNPJ com tamanho incorreto", () => {
    expect(cnpjValido("123")).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e ver FALHAR**

Run: `npm test -- cnpj`
Expected: FALHA — `../cnpj` não existe.

- [ ] **Step 3: Implementação mínima**

`src/domain/cadastro/cnpj.ts`:
```ts
export function normalizarCnpj(cnpj: string): string {
  return cnpj.replace(/\D/g, "");
}

function digitoVerificador(base: number[], pesos: number[]): number {
  const soma = base.reduce((acc, digito, i) => acc + digito * pesos[i], 0);
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

export function cnpjValido(cnpjComOuSemMascara: string): boolean {
  const cnpj = normalizarCnpj(cnpjComOuSemMascara);
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;

  const digitos = cnpj.split("").map(Number);
  const base12 = digitos.slice(0, 12);

  const pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const digito1 = digitoVerificador(base12, pesos1);

  const pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const digito2 = digitoVerificador([...base12, digito1], pesos2);

  return digitos[12] === digito1 && digitos[13] === digito2;
}
```

- [ ] **Step 4: Rodar e ver PASSAR**

Run: `npm test -- cnpj`
Expected: PASS (6 testes).

- [ ] **Step 5: Commit**

```bash
git add src/domain/cadastro/cnpj.ts src/domain/cadastro/__tests__/cnpj.test.ts
git commit -m "feat(domain): validador de CNPJ com testes (RF02)"
```

---

### Task 2: Schema Prisma de Cadastros & Acesso + migração

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/bootstrap-admin.ts`
- Test: `src/lib/__tests__/cadastros-schema.test.ts`

**Interfaces:**
- Produces: modelos Prisma `Fabrica`, `Cliente`, `ClienteFabrica`, `Usuario`,
  `UsuarioFabrica`, `EventoAuditoria`, enums `PerfilUsuario` e
  `TipoConfirmacaoEstoque`, consumidos por todas as tasks seguintes.

- [ ] **Step 1: Adicionar os modelos ao schema**

Em `prisma/schema.prisma`, manter o `model Parametro` existente e adicionar:

```prisma
enum PerfilUsuario {
  OPERADOR
  ANALISTA
  ADMIN
}

enum TipoConfirmacaoEstoque {
  AUTOMATICA
  PRESUMIDA
}

model Fabrica {
  id              String           @id @default(cuid())
  nome            String
  cnpj            String           @unique
  flagConciliacao Boolean          @default(false)
  criadoEm        DateTime         @default(now())
  clientes        ClienteFabrica[]
  usuarios        UsuarioFabrica[]
}

model Cliente {
  id           String           @id @default(cuid())
  cnpj         String           @unique
  nomeFantasia String
  criadoEm     DateTime         @default(now())
  fabricas     ClienteFabrica[]
}

model ClienteFabrica {
  id                     String                 @id @default(cuid())
  clienteId              String
  fabricaId              String
  flagAcessoSistema      Boolean                @default(false)
  tipoConfirmacaoEstoque TipoConfirmacaoEstoque @default(PRESUMIDA)
  cliente                Cliente                @relation(fields: [clienteId], references: [id])
  fabrica                Fabrica                @relation(fields: [fabricaId], references: [id])

  @@unique([clienteId, fabricaId])
}

model Usuario {
  id             String            @id @default(cuid())
  supabaseUserId String            @unique
  nome           String
  email          String            @unique
  perfil         PerfilUsuario     @default(OPERADOR)
  criadoEm       DateTime          @default(now())
  fabricas       UsuarioFabrica[]
  eventos        EventoAuditoria[]
}

model UsuarioFabrica {
  id        String  @id @default(cuid())
  usuarioId String
  fabricaId String
  usuario   Usuario @relation(fields: [usuarioId], references: [id])
  fabrica   Fabrica @relation(fields: [fabricaId], references: [id])

  @@unique([usuarioId, fabricaId])
}

model EventoAuditoria {
  id            String   @id @default(cuid())
  entidade      String
  entidadeId    String
  campo         String
  valorAnterior String?
  valorNovo     String?
  usuarioId     String
  usuario       Usuario  @relation(fields: [usuarioId], references: [id])
  criadoEm      DateTime @default(now())

  @@index([entidade, entidadeId])
}
```

- [ ] **Step 2: Criar a migração**

Run: `npx prisma migrate dev --name cadastros-acesso`
Expected: cria as tabelas `Fabrica`, `Cliente`, `ClienteFabrica`, `Usuario`,
`UsuarioFabrica`, `EventoAuditoria` no Postgres da Supabase.

- [ ] **Step 3: Teste de persistência (criação/leitura, N:N)**

`src/lib/__tests__/cadastros-schema.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { prisma } from "../prisma";

describe("schema de cadastros", () => {
  it("cria fábrica e cliente vinculados (N:N) e lê de volta", async () => {
    const fabrica = await prisma.fabrica.create({
      data: { nome: "Bowden Teste", cnpj: "11444777000161" },
    });
    const cliente = await prisma.cliente.create({
      data: { cnpj: "11222333000181", nomeFantasia: "Cliente Teste" },
    });
    await prisma.clienteFabrica.create({
      data: { clienteId: cliente.id, fabricaId: fabrica.id, flagAcessoSistema: true },
    });

    const lido = await prisma.cliente.findUnique({
      where: { id: cliente.id },
      include: { fabricas: true },
    });

    expect(lido?.fabricas).toHaveLength(1);
    expect(lido?.fabricas[0].fabricaId).toBe(fabrica.id);

    await prisma.clienteFabrica.deleteMany({ where: { clienteId: cliente.id } });
    await prisma.cliente.delete({ where: { id: cliente.id } });
    await prisma.fabrica.delete({ where: { id: fabrica.id } });
  });
});
```

- [ ] **Step 4: Rodar e ver PASSAR**

Run: `npm test -- cadastros-schema`
Expected: PASS. (Se falhar com erro de conexão/timeout na porta 5432, ver nota em
Global Constraints — registre e siga para o Step 5.)

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations src/lib/__tests__/cadastros-schema.test.ts
git commit -m "feat: schema Prisma de Fábrica/Cliente/Usuário + auditoria (RF01/RF02/RF32)"
```

- [ ] **Step 6 (gate manual, fora do ciclo TDD): criar o primeiro usuário ADMIN**

A tela de Usuários (Task 8) só funciona se já existir pelo menos um `Usuario` com
perfil `ADMIN` vinculado ao login Supabase do dono. Criar o script utilitário:

`prisma/bootstrap-admin.ts`:
```ts
import { prisma } from "../src/lib/prisma";

const [supabaseUserId, nome, email] = process.argv.slice(2);

if (!supabaseUserId || !nome || !email) {
  console.error(
    'Uso: npx tsx prisma/bootstrap-admin.ts "<supabaseUserId>" "<nome>" "<email>"',
  );
  process.exit(1);
}

async function main() {
  const usuario = await prisma.usuario.upsert({
    where: { supabaseUserId },
    update: {},
    create: { supabaseUserId, nome, email, perfil: "ADMIN" },
  });
  console.log("Usuário ADMIN criado/confirmado:", usuario.email);
}

main().finally(() => prisma.$disconnect());
```

Instalar o executor TypeScript e rodar:
```bash
npm install -D tsx
```

Pedir ao dono o **UID** do login que ele já usa (Supabase dashboard → Authentication →
Users → coluna `UID`, ícone de copiar) e o e-mail correspondente, depois rodar:
```bash
npx tsx prisma/bootstrap-admin.ts "<UID copiado>" "<Nome do dono>" "<email do dono>"
```
Expected: log `Usuário ADMIN criado/confirmado: <email>`.

```bash
git add prisma/bootstrap-admin.ts package.json package-lock.json
git commit -m "chore: script de bootstrap do primeiro usuário ADMIN"
```

---

### Task 3: Função de auditoria pura — diff de campos

**Files:**
- Create: `src/domain/auditoria/evento.ts`
- Test: `src/domain/auditoria/__tests__/evento.test.ts`

**Interfaces:**
- Produces:
  - `type EventoAuditoriaInput = { entidade: string; entidadeId: string; campo: string; valorAnterior: string | null; valorNovo: string | null; usuarioId: string }`
  - `function compararCampos(entidade: string, entidadeId: string, usuarioId: string, antes: Record<string, unknown>, depois: Record<string, unknown>): EventoAuditoriaInput[]`

- [ ] **Step 1: Escrever os testes que falham**

`src/domain/auditoria/__tests__/evento.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { compararCampos } from "../evento";

describe("compararCampos", () => {
  it("gera um evento por campo alterado", () => {
    const eventos = compararCampos(
      "Fabrica",
      "fab-1",
      "user-1",
      { nome: "Bowden", cnpj: "111" },
      { nome: "Bowden Ltda", cnpj: "111" },
    );

    expect(eventos).toEqual([
      {
        entidade: "Fabrica",
        entidadeId: "fab-1",
        campo: "nome",
        valorAnterior: "Bowden",
        valorNovo: "Bowden Ltda",
        usuarioId: "user-1",
      },
    ]);
  });

  it("não gera evento quando nada muda", () => {
    const eventos = compararCampos(
      "Fabrica",
      "fab-1",
      "user-1",
      { nome: "Bowden" },
      { nome: "Bowden" },
    );
    expect(eventos).toEqual([]);
  });

  it("trata criação (antes vazio) com valorAnterior nulo", () => {
    const eventos = compararCampos("Cliente", "cli-1", "user-1", {}, { nome: "Novo" });
    expect(eventos).toEqual([
      {
        entidade: "Cliente",
        entidadeId: "cli-1",
        campo: "nome",
        valorAnterior: null,
        valorNovo: "Novo",
        usuarioId: "user-1",
      },
    ]);
  });
});
```

- [ ] **Step 2: Rodar e ver FALHAR**

Run: `npm test -- evento`
Expected: FALHA — `../evento` não existe.

- [ ] **Step 3: Implementação mínima**

`src/domain/auditoria/evento.ts`:
```ts
export type EventoAuditoriaInput = {
  entidade: string;
  entidadeId: string;
  campo: string;
  valorAnterior: string | null;
  valorNovo: string | null;
  usuarioId: string;
};

function paraTexto(valor: unknown): string | null {
  return valor === null || valor === undefined ? null : String(valor);
}

export function compararCampos(
  entidade: string,
  entidadeId: string,
  usuarioId: string,
  antes: Record<string, unknown>,
  depois: Record<string, unknown>,
): EventoAuditoriaInput[] {
  const eventos: EventoAuditoriaInput[] = [];

  for (const campo of Object.keys(depois)) {
    const valorAnterior = antes[campo];
    const valorNovo = depois[campo];
    if (valorAnterior !== valorNovo) {
      eventos.push({
        entidade,
        entidadeId,
        campo,
        valorAnterior: paraTexto(valorAnterior),
        valorNovo: paraTexto(valorNovo),
        usuarioId,
      });
    }
  }

  return eventos;
}
```

- [ ] **Step 4: Rodar e ver PASSAR**

Run: `npm test -- evento`
Expected: PASS (3 testes).

- [ ] **Step 5: Commit**

```bash
git add src/domain/auditoria/evento.ts src/domain/auditoria/__tests__/evento.test.ts
git commit -m "feat(domain): diff puro de campos para auditoria (RF32)"
```

---

### Task 4: Helper `registrarAlteracoes()` (gravação imutável)

**Files:**
- Create: `src/lib/auditoria.ts`
- Test: `src/lib/__tests__/auditoria.test.ts`

**Interfaces:**
- Consumes: `EventoAuditoriaInput` (Task 3), `prisma` (`@/lib/prisma`), `Usuario`
  (Task 2 — precisa de um `usuarioId` válido para a FK).
- Produces: `async function registrarAlteracoes(eventos: EventoAuditoriaInput[]): Promise<void>`

- [ ] **Step 1: Escrever o teste que falha**

`src/lib/__tests__/auditoria.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { prisma } from "../prisma";
import { registrarAlteracoes } from "../auditoria";

describe("registrarAlteracoes", () => {
  it("grava eventos e cada chamada cria linhas novas (imutável)", async () => {
    const usuario = await prisma.usuario.create({
      data: {
        supabaseUserId: `teste-${Date.now()}`,
        nome: "Usuário Teste",
        email: `teste-${Date.now()}@exemplo.com`,
      },
    });

    await registrarAlteracoes([
      {
        entidade: "Fabrica",
        entidadeId: "fab-x",
        campo: "nome",
        valorAnterior: null,
        valorNovo: "Bowden",
        usuarioId: usuario.id,
      },
    ]);
    await registrarAlteracoes([
      {
        entidade: "Fabrica",
        entidadeId: "fab-x",
        campo: "nome",
        valorAnterior: "Bowden",
        valorNovo: "Bowden Ltda",
        usuarioId: usuario.id,
      },
    ]);

    const eventos = await prisma.eventoAuditoria.findMany({
      where: { entidadeId: "fab-x" },
      orderBy: { criadoEm: "asc" },
    });

    expect(eventos).toHaveLength(2);
    expect(eventos[0].valorNovo).toBe("Bowden"); // primeira gravação intacta
    expect(eventos[1].valorNovo).toBe("Bowden Ltda");

    await prisma.eventoAuditoria.deleteMany({ where: { entidadeId: "fab-x" } });
    await prisma.usuario.delete({ where: { id: usuario.id } });
  });
});
```

- [ ] **Step 2: Rodar e ver FALHAR**

Run: `npm test -- auditoria`
Expected: FALHA — `../auditoria` não existe.

- [ ] **Step 3: Implementação mínima**

`src/lib/auditoria.ts`:
```ts
import { prisma } from "./prisma";
import type { EventoAuditoriaInput } from "@/domain/auditoria/evento";

export async function registrarAlteracoes(eventos: EventoAuditoriaInput[]): Promise<void> {
  if (eventos.length === 0) return;
  await prisma.eventoAuditoria.createMany({ data: eventos });
}
```

Não exportar nenhuma função de update/delete deste módulo — é assim que a
imutabilidade é garantida (nenhum código no projeto pode alterar um evento já gravado).

- [ ] **Step 4: Rodar e ver PASSAR**

Run: `npm test -- auditoria`
Expected: PASS. (Mesma nota de rede de Global Constraints se houver timeout.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/auditoria.ts src/lib/__tests__/auditoria.test.ts
git commit -m "feat: registrarAlteracoes grava EventoAuditoria de forma imutável (RF32)"
```

---

### Task 5: Regra de acesso por fábrica (`podeAcessarFabrica`)

**Files:**
- Create: `src/lib/authz.ts`
- Test: `src/lib/__tests__/authz.test.ts`

**Interfaces:**
- Produces:
  - `type PerfilUsuario = "OPERADOR" | "ANALISTA" | "ADMIN"`
  - `type UsuarioAcesso = { perfil: PerfilUsuario; fabricasIds: string[] }`
  - `function podeAcessarFabrica(usuario: UsuarioAcesso, fabricaId: string): boolean`

- [ ] **Step 1: Escrever os testes que falham**

`src/lib/__tests__/authz.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { podeAcessarFabrica } from "../authz";

describe("podeAcessarFabrica", () => {
  it("ADMIN acessa qualquer fábrica mesmo sem vínculo", () => {
    expect(podeAcessarFabrica({ perfil: "ADMIN", fabricasIds: [] }, "fab-1")).toBe(true);
  });

  it("OPERADOR acessa fábrica vinculada", () => {
    expect(
      podeAcessarFabrica({ perfil: "OPERADOR", fabricasIds: ["fab-1"] }, "fab-1"),
    ).toBe(true);
  });

  it("ANALISTA não acessa fábrica não vinculada", () => {
    expect(
      podeAcessarFabrica({ perfil: "ANALISTA", fabricasIds: ["fab-1"] }, "fab-2"),
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e ver FALHAR**

Run: `npm test -- authz`
Expected: FALHA — `../authz` não existe.

- [ ] **Step 3: Implementação mínima**

`src/lib/authz.ts`:
```ts
export type PerfilUsuario = "OPERADOR" | "ANALISTA" | "ADMIN";

export type UsuarioAcesso = {
  perfil: PerfilUsuario;
  fabricasIds: string[];
};

export function podeAcessarFabrica(usuario: UsuarioAcesso, fabricaId: string): boolean {
  if (usuario.perfil === "ADMIN") return true;
  return usuario.fabricasIds.includes(fabricaId);
}
```

- [ ] **Step 4: Rodar e ver PASSAR**

Run: `npm test -- authz`
Expected: PASS (3 testes).

- [ ] **Step 5: Commit**

```bash
git add src/lib/authz.ts src/lib/__tests__/authz.test.ts
git commit -m "feat: regra pura de acesso por fábrica (ADR-009)"
```

---

### Task 6: Sessão do usuário logado + Cadastro de Fábricas

**Files:**
- Create: `src/lib/sessao.ts`
- Create: `src/domain/cadastro/fabrica.ts` (+test)
- Create: `src/app/(app)/cadastros/layout.tsx`
- Create: `src/app/(app)/cadastros/fabricas/page.tsx`
- Create: `src/app/(app)/cadastros/fabricas/actions.ts`
- Create: `src/app/(app)/cadastros/fabricas/novo/page.tsx`
- Modify: `e2e/smoke.spec.ts` (adicionar caso de `/cadastros/fabricas`)

**Interfaces:**
- Consumes: `cnpjValido` (Task 1), `compararCampos` (Task 3), `registrarAlteracoes`
  (Task 4), `prisma` (Task 2).
- Produces:
  - `function validarDadosFabrica(dados: { nome: string; cnpj: string }): string[]`
  - `async function obterUsuarioLogado(): Promise<{ id: string; nome: string; perfil: PerfilUsuario; fabricasIds: string[] } | null>`

- [ ] **Step 1: Escrever o teste de validação que falha**

`src/domain/cadastro/__tests__/fabrica.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { validarDadosFabrica } from "../fabrica";

describe("validarDadosFabrica", () => {
  it("aceita dados válidos", () => {
    expect(validarDadosFabrica({ nome: "Bowden", cnpj: "11444777000161" })).toEqual([]);
  });

  it("rejeita nome vazio", () => {
    expect(validarDadosFabrica({ nome: "  ", cnpj: "11444777000161" })).toContain(
      "Nome é obrigatório.",
    );
  });

  it("rejeita CNPJ inválido", () => {
    expect(validarDadosFabrica({ nome: "Bowden", cnpj: "123" })).toContain(
      "CNPJ inválido.",
    );
  });
});
```

- [ ] **Step 2: Rodar e ver FALHAR**

Run: `npm test -- domain/cadastro/__tests__/fabrica`
Expected: FALHA — `../fabrica` não existe.

- [ ] **Step 3: Implementação mínima da validação**

`src/domain/cadastro/fabrica.ts`:
```ts
import { cnpjValido } from "./cnpj";

export type DadosFabrica = { nome: string; cnpj: string };

export function validarDadosFabrica(dados: DadosFabrica): string[] {
  const erros: string[] = [];
  if (!dados.nome.trim()) erros.push("Nome é obrigatório.");
  if (!cnpjValido(dados.cnpj)) erros.push("CNPJ inválido.");
  return erros;
}
```

- [ ] **Step 4: Rodar e ver PASSAR**

Run: `npm test -- domain/cadastro/__tests__/fabrica`
Expected: PASS (3 testes).

- [ ] **Step 5: Helper de sessão (sem teste unitário — wiring de framework)**

`src/lib/sessao.ts`:
```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { prisma } from "./prisma";
import type { PerfilUsuario } from "./authz";

export type UsuarioSessao = {
  id: string;
  nome: string;
  perfil: PerfilUsuario;
  fabricasIds: string[];
};

export async function obterUsuarioLogado(): Promise<UsuarioSessao | null> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    },
  );

  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;

  const usuario = await prisma.usuario.findUnique({
    where: { supabaseUserId: data.user.id },
    include: { fabricas: true },
  });
  if (!usuario) return null;

  return {
    id: usuario.id,
    nome: usuario.nome,
    perfil: usuario.perfil as PerfilUsuario,
    fabricasIds: usuario.fabricas.map((f) => f.fabricaId),
  };
}
```

- [ ] **Step 6: Sub-layout de Cadastros (tabs)**

`src/app/(app)/cadastros/layout.tsx`:
```tsx
import Link from "next/link";

export default function CadastrosLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <nav className="flex gap-4 border-b pb-2">
        <Link href="/cadastros/fabricas">Fábricas</Link>
        <Link href="/cadastros/clientes">Clientes</Link>
        <Link href="/cadastros/usuarios">Usuários</Link>
      </nav>
      {children}
    </div>
  );
}
```

- [ ] **Step 7: Server Action de criação**

`src/app/(app)/cadastros/fabricas/actions.ts`:
```ts
"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { obterUsuarioLogado } from "@/lib/sessao";
import { validarDadosFabrica } from "@/domain/cadastro/fabrica";
import { normalizarCnpj } from "@/domain/cadastro/cnpj";
import { compararCampos } from "@/domain/auditoria/evento";
import { registrarAlteracoes } from "@/lib/auditoria";

export async function criarFabrica(formData: FormData): Promise<{ erros: string[] }> {
  const nome = String(formData.get("nome") ?? "");
  const cnpj = String(formData.get("cnpj") ?? "");

  const erros = validarDadosFabrica({ nome, cnpj });
  if (erros.length > 0) return { erros };

  const usuario = await obterUsuarioLogado();
  if (!usuario) return { erros: ["Sessão expirada. Faça login novamente."] };

  const fabrica = await prisma.fabrica.create({
    data: { nome, cnpj: normalizarCnpj(cnpj) },
  });

  await registrarAlteracoes(
    compararCampos("Fabrica", fabrica.id, usuario.id, {}, { nome: fabrica.nome, cnpj: fabrica.cnpj }),
  );

  revalidatePath("/cadastros/fabricas");
  return { erros: [] };
}
```

- [ ] **Step 8: Tela de lista**

`src/app/(app)/cadastros/fabricas/page.tsx`:
```tsx
import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function FabricasPage() {
  const fabricas = await prisma.fabrica.findMany({ orderBy: { nome: "asc" } });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Fábricas</h1>
        <Link href="/cadastros/fabricas/novo" className="rounded bg-black px-3 py-2 text-white">
          Nova fábrica
        </Link>
      </div>
      <table className="w-full text-left text-sm">
        <thead>
          <tr>
            <th className="border-b p-2">Nome</th>
            <th className="border-b p-2">CNPJ</th>
          </tr>
        </thead>
        <tbody>
          {fabricas.map((f) => (
            <tr key={f.id}>
              <td className="border-b p-2">{f.nome}</td>
              <td className="border-b p-2">{f.cnpj}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 9: Tela de criação**

`src/app/(app)/cadastros/fabricas/novo/page.tsx`:
```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { criarFabrica } from "../actions";

export default function NovaFabricaPage() {
  const router = useRouter();
  const [erros, setErros] = useState<string[]>([]);

  async function handleSubmit(formData: FormData) {
    const resultado = await criarFabrica(formData);
    if (resultado.erros.length > 0) {
      setErros(resultado.erros);
      return;
    }
    router.push("/cadastros/fabricas");
  }

  return (
    <form action={handleSubmit} className="flex max-w-sm flex-col gap-4">
      <h1 className="text-lg font-semibold">Nova fábrica</h1>
      <input name="nome" placeholder="Nome" className="rounded border px-3 py-2" required />
      <input name="cnpj" placeholder="CNPJ" className="rounded border px-3 py-2" required />
      {erros.map((erro) => (
        <p key={erro} className="text-sm text-red-600">{erro}</p>
      ))}
      <button type="submit" className="rounded bg-black px-3 py-2 text-white">Salvar</button>
    </form>
  );
}
```

- [ ] **Step 10: e2e mínimo — proteção de rota**

Em `e2e/smoke.spec.ts`, adicionar:
```ts
test("visitante não logado é redirecionado de /cadastros/fabricas", async ({ page }) => {
  await page.goto("/cadastros/fabricas");
  await expect(page).toHaveURL(/\/login/);
});
```

Run: `npm run e2e`
Expected: PASS.

- [ ] **Step 11: Verificação manual**

Run: `npm run dev` → logar com o usuário ADMIN criado na Task 2 → abrir
`/cadastros/fabricas` → cadastrar uma fábrica (ex.: "Bowden") → confirmar que aparece
na lista e que surge uma linha em `EventoAuditoria` (pode checar via
`npx prisma studio`).

- [ ] **Step 12: Commit**

```bash
git add src/lib/sessao.ts src/domain/cadastro/fabrica.ts src/domain/cadastro/__tests__/fabrica.test.ts src/app/\(app\)/cadastros e2e/smoke.spec.ts
git commit -m "feat: cadastro de fábricas com auditoria (RF01)"
```

---

### Task 7: Cadastro de Clientes (multi-fábrica)

**Files:**
- Create: `src/domain/cadastro/cliente.ts` (+test)
- Create: `src/app/(app)/cadastros/clientes/page.tsx`
- Create: `src/app/(app)/cadastros/clientes/actions.ts`
- Create: `src/app/(app)/cadastros/clientes/novo/page.tsx`
- Modify: `e2e/smoke.spec.ts`

**Interfaces:**
- Consumes: `cnpjValido` (Task 1), `compararCampos`/`registrarAlteracoes` (Tasks 3–4),
  `obterUsuarioLogado` (Task 6).
- Produces: `function validarDadosCliente(dados: { nomeFantasia: string; cnpj: string; fabricasIds: string[] }): string[]`

- [ ] **Step 1: Escrever o teste de validação que falha**

`src/domain/cadastro/__tests__/cliente.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { validarDadosCliente } from "../cliente";

describe("validarDadosCliente", () => {
  it("aceita dados válidos com ao menos uma fábrica", () => {
    expect(
      validarDadosCliente({
        nomeFantasia: "Distribuidora X",
        cnpj: "11222333000181",
        fabricasIds: ["fab-1"],
      }),
    ).toEqual([]);
  });

  it("rejeita cliente sem nenhuma fábrica vinculada", () => {
    expect(
      validarDadosCliente({ nomeFantasia: "Distribuidora X", cnpj: "11222333000181", fabricasIds: [] }),
    ).toContain("Selecione ao menos uma fábrica.");
  });

  it("rejeita CNPJ inválido", () => {
    expect(
      validarDadosCliente({ nomeFantasia: "Distribuidora X", cnpj: "123", fabricasIds: ["fab-1"] }),
    ).toContain("CNPJ inválido.");
  });
});
```

- [ ] **Step 2: Rodar e ver FALHAR**

Run: `npm test -- domain/cadastro/__tests__/cliente`
Expected: FALHA — `../cliente` não existe.

- [ ] **Step 3: Implementação mínima**

`src/domain/cadastro/cliente.ts`:
```ts
import { cnpjValido } from "./cnpj";

export type DadosCliente = {
  nomeFantasia: string;
  cnpj: string;
  fabricasIds: string[];
};

export function validarDadosCliente(dados: DadosCliente): string[] {
  const erros: string[] = [];
  if (!dados.nomeFantasia.trim()) erros.push("Nome fantasia é obrigatório.");
  if (!cnpjValido(dados.cnpj)) erros.push("CNPJ inválido.");
  if (dados.fabricasIds.length === 0) erros.push("Selecione ao menos uma fábrica.");
  return erros;
}
```

- [ ] **Step 4: Rodar e ver PASSAR**

Run: `npm test -- domain/cadastro/__tests__/cliente`
Expected: PASS (3 testes).

- [ ] **Step 5: Server Action de criação (multi-fábrica, RN23)**

`src/app/(app)/cadastros/clientes/actions.ts`:
```ts
"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { obterUsuarioLogado } from "@/lib/sessao";
import { validarDadosCliente } from "@/domain/cadastro/cliente";
import { normalizarCnpj } from "@/domain/cadastro/cnpj";
import { compararCampos } from "@/domain/auditoria/evento";
import { registrarAlteracoes } from "@/lib/auditoria";

export async function criarCliente(formData: FormData): Promise<{ erros: string[] }> {
  const nomeFantasia = String(formData.get("nomeFantasia") ?? "");
  const cnpj = String(formData.get("cnpj") ?? "");
  const fabricasIds = formData.getAll("fabricasIds").map(String);
  const tipoConfirmacaoEstoque = String(formData.get("tipoConfirmacaoEstoque") ?? "PRESUMIDA") as
    | "AUTOMATICA"
    | "PRESUMIDA";
  const flagAcessoSistema = formData.get("flagAcessoSistema") === "on";

  const erros = validarDadosCliente({ nomeFantasia, cnpj, fabricasIds });
  if (erros.length > 0) return { erros };

  const usuario = await obterUsuarioLogado();
  if (!usuario) return { erros: ["Sessão expirada. Faça login novamente."] };

  const cliente = await prisma.cliente.create({
    data: { nomeFantasia, cnpj: normalizarCnpj(cnpj) },
  });

  // RN23: cada vínculo Cliente×Fábrica é independente.
  await prisma.clienteFabrica.createMany({
    data: fabricasIds.map((fabricaId) => ({
      clienteId: cliente.id,
      fabricaId,
      flagAcessoSistema,
      tipoConfirmacaoEstoque,
    })),
  });

  await registrarAlteracoes(
    compararCampos(
      "Cliente",
      cliente.id,
      usuario.id,
      {},
      { nomeFantasia: cliente.nomeFantasia, cnpj: cliente.cnpj, fabricasIds: fabricasIds.join(",") },
    ),
  );

  revalidatePath("/cadastros/clientes");
  return { erros: [] };
}
```

- [ ] **Step 6: Tela de lista**

`src/app/(app)/cadastros/clientes/page.tsx`:
```tsx
import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function ClientesPage() {
  const clientes = await prisma.cliente.findMany({
    orderBy: { nomeFantasia: "asc" },
    include: { fabricas: { include: { fabrica: true } } },
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Clientes</h1>
        <Link href="/cadastros/clientes/novo" className="rounded bg-black px-3 py-2 text-white">
          Novo cliente
        </Link>
      </div>
      <table className="w-full text-left text-sm">
        <thead>
          <tr>
            <th className="border-b p-2">Nome fantasia</th>
            <th className="border-b p-2">CNPJ</th>
            <th className="border-b p-2">Fábricas</th>
          </tr>
        </thead>
        <tbody>
          {clientes.map((c) => (
            <tr key={c.id}>
              <td className="border-b p-2">{c.nomeFantasia}</td>
              <td className="border-b p-2">{c.cnpj}</td>
              <td className="border-b p-2">
                {c.fabricas.map((cf) => cf.fabrica.nome).join(", ")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 7: Tela de criação**

`src/app/(app)/cadastros/clientes/novo/page.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { criarCliente } from "../actions";

type Fabrica = { id: string; nome: string };

export default function NovoClientePage() {
  const router = useRouter();
  const [erros, setErros] = useState<string[]>([]);
  const [fabricas, setFabricas] = useState<Fabrica[]>([]);

  useEffect(() => {
    fetch("/api/fabricas")
      .then((r) => r.json())
      .then(setFabricas);
  }, []);

  async function handleSubmit(formData: FormData) {
    const resultado = await criarCliente(formData);
    if (resultado.erros.length > 0) {
      setErros(resultado.erros);
      return;
    }
    router.push("/cadastros/clientes");
  }

  return (
    <form action={handleSubmit} className="flex max-w-sm flex-col gap-4">
      <h1 className="text-lg font-semibold">Novo cliente</h1>
      <input name="nomeFantasia" placeholder="Nome fantasia" className="rounded border px-3 py-2" required />
      <input name="cnpj" placeholder="CNPJ" className="rounded border px-3 py-2" required />
      <fieldset className="flex flex-col gap-1">
        <legend className="text-sm font-medium">Fábricas atendidas</legend>
        {fabricas.map((f) => (
          <label key={f.id} className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="fabricasIds" value={f.id} />
            {f.nome}
          </label>
        ))}
      </fieldset>
      <select name="tipoConfirmacaoEstoque" className="rounded border px-3 py-2">
        <option value="PRESUMIDA">Confirmação presumida</option>
        <option value="AUTOMATICA">Confirmação automática</option>
      </select>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="flagAcessoSistema" />
        Tem acesso ao sistema interno da fábrica
      </label>
      {erros.map((erro) => (
        <p key={erro} className="text-sm text-red-600">{erro}</p>
      ))}
      <button type="submit" className="rounded bg-black px-3 py-2 text-white">Salvar</button>
    </form>
  );
}
```

- [ ] **Step 8: Rota auxiliar para listar fábricas no formulário**

`src/app/api/fabricas/route.ts`:
```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const fabricas = await prisma.fabrica.findMany({
    select: { id: true, nome: true },
    orderBy: { nome: "asc" },
  });
  return NextResponse.json(fabricas);
}
```

- [ ] **Step 9: e2e mínimo — proteção de rota**

Em `e2e/smoke.spec.ts`, adicionar:
```ts
test("visitante não logado é redirecionado de /cadastros/clientes", async ({ page }) => {
  await page.goto("/cadastros/clientes");
  await expect(page).toHaveURL(/\/login/);
});
```

Run: `npm run e2e`
Expected: PASS.

- [ ] **Step 10: Verificação manual**

Run: `npm run dev` → logado como ADMIN → cadastrar um cliente marcando 1+ fábricas →
confirmar que a lista mostra as fábricas vinculadas e que há novo `EventoAuditoria`.

- [ ] **Step 11: Commit**

```bash
git add src/domain/cadastro/cliente.ts src/domain/cadastro/__tests__/cliente.test.ts src/app/\(app\)/cadastros/clientes src/app/api/fabricas e2e/smoke.spec.ts
git commit -m "feat: cadastro de clientes multi-fábrica com auditoria (RF02, RN23)"
```

---

### Task 8: Cadastro de Usuários (perfis + permissão por fábrica, ADMIN-only)

**Files:**
- Create: `src/domain/cadastro/usuario.ts` (+test)
- Create: `src/app/(app)/cadastros/usuarios/page.tsx`
- Create: `src/app/(app)/cadastros/usuarios/actions.ts`
- Create: `src/app/(app)/cadastros/usuarios/novo/page.tsx`
- Modify: `e2e/smoke.spec.ts`

**Interfaces:**
- Consumes: `podeAcessarFabrica`/`PerfilUsuario` (Task 5), `obterUsuarioLogado`
  (Task 6), `compararCampos`/`registrarAlteracoes` (Tasks 3–4).
- Produces: `function validarDadosUsuario(dados: { nome: string; email: string; perfil: PerfilUsuario; fabricasIds: string[] }): string[]`

- [ ] **Step 1: Escrever o teste de validação que falha**

`src/domain/cadastro/__tests__/usuario.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { validarDadosUsuario } from "../usuario";

describe("validarDadosUsuario", () => {
  it("aceita ADMIN sem fábrica vinculada", () => {
    expect(
      validarDadosUsuario({ nome: "Ana", email: "ana@exemplo.com", perfil: "ADMIN", fabricasIds: [] }),
    ).toEqual([]);
  });

  it("exige ao menos uma fábrica para OPERADOR/ANALISTA", () => {
    expect(
      validarDadosUsuario({ nome: "Bia", email: "bia@exemplo.com", perfil: "OPERADOR", fabricasIds: [] }),
    ).toContain("Operador e Analista precisam de ao menos uma fábrica.");
  });

  it("rejeita e-mail mal formado", () => {
    expect(
      validarDadosUsuario({ nome: "Bia", email: "invalido", perfil: "ADMIN", fabricasIds: [] }),
    ).toContain("E-mail inválido.");
  });

  it("rejeita nome vazio", () => {
    expect(
      validarDadosUsuario({ nome: "  ", email: "ana@exemplo.com", perfil: "ADMIN", fabricasIds: [] }),
    ).toContain("Nome é obrigatório.");
  });
});
```

- [ ] **Step 2: Rodar e ver FALHAR**

Run: `npm test -- domain/cadastro/__tests__/usuario`
Expected: FALHA — `../usuario` não existe.

- [ ] **Step 3: Implementação mínima**

`src/domain/cadastro/usuario.ts`:
```ts
import type { PerfilUsuario } from "@/lib/authz";

export type DadosUsuario = {
  nome: string;
  email: string;
  perfil: PerfilUsuario;
  fabricasIds: string[];
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validarDadosUsuario(dados: DadosUsuario): string[] {
  const erros: string[] = [];
  if (!dados.nome.trim()) erros.push("Nome é obrigatório.");
  if (!EMAIL_REGEX.test(dados.email)) erros.push("E-mail inválido.");
  if (dados.perfil !== "ADMIN" && dados.fabricasIds.length === 0) {
    erros.push("Operador e Analista precisam de ao menos uma fábrica.");
  }
  return erros;
}
```

- [ ] **Step 4: Rodar e ver PASSAR**

Run: `npm test -- domain/cadastro/__tests__/usuario`
Expected: PASS (4 testes).

- [ ] **Step 5: Server Action de criação (cria convite via Supabase Auth + Usuario)**

`src/app/(app)/cadastros/usuarios/actions.ts`:
```ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import { obterUsuarioLogado } from "@/lib/sessao";
import { validarDadosUsuario } from "@/domain/cadastro/usuario";
import type { PerfilUsuario } from "@/lib/authz";
import { compararCampos } from "@/domain/auditoria/evento";
import { registrarAlteracoes } from "@/lib/auditoria";

export async function criarUsuario(formData: FormData): Promise<{ erros: string[] }> {
  const ator = await obterUsuarioLogado();
  if (!ator) return { erros: ["Sessão expirada. Faça login novamente."] };
  if (ator.perfil !== "ADMIN") return { erros: ["Apenas ADMIN pode cadastrar usuários."] };

  const nome = String(formData.get("nome") ?? "");
  const email = String(formData.get("email") ?? "");
  const perfil = String(formData.get("perfil") ?? "OPERADOR") as PerfilUsuario;
  const fabricasIds = formData.getAll("fabricasIds").map(String);

  const erros = validarDadosUsuario({ nome, email, perfil, fabricasIds });
  if (erros.length > 0) return { erros };

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email);
  if (error || !data.user) return { erros: [`Falha ao convidar usuário: ${error?.message}`] };

  const usuario = await prisma.usuario.create({
    data: { supabaseUserId: data.user.id, nome, email, perfil },
  });

  await prisma.usuarioFabrica.createMany({
    data: fabricasIds.map((fabricaId) => ({ usuarioId: usuario.id, fabricaId })),
  });

  await registrarAlteracoes(
    compararCampos(
      "Usuario",
      usuario.id,
      ator.id,
      {},
      { nome: usuario.nome, email: usuario.email, perfil: usuario.perfil, fabricasIds: fabricasIds.join(",") },
    ),
  );

  revalidatePath("/cadastros/usuarios");
  return { erros: [] };
}
```

`.env.example` — adicionar linha (sem valor real):
```
SUPABASE_SERVICE_ROLE_KEY="cole-a-service-role-key-do-painel-supabase"
```
Pedir ao dono a `service_role key` (Supabase dashboard → Project Settings → API) e
colar no `.env` real (não versionado).

- [ ] **Step 6: Tela de lista (gate de perfil)**

`src/app/(app)/cadastros/usuarios/page.tsx`:
```tsx
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { obterUsuarioLogado } from "@/lib/sessao";

export default async function UsuariosPage() {
  const usuarioLogado = await obterUsuarioLogado();

  if (!usuarioLogado || usuarioLogado.perfil !== "ADMIN") {
    return <p className="text-sm text-red-600">Acesso restrito a administradores.</p>;
  }

  const usuarios = await prisma.usuario.findMany({
    orderBy: { nome: "asc" },
    include: { fabricas: { include: { fabrica: true } } },
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Usuários</h1>
        <Link href="/cadastros/usuarios/novo" className="rounded bg-black px-3 py-2 text-white">
          Novo usuário
        </Link>
      </div>
      <table className="w-full text-left text-sm">
        <thead>
          <tr>
            <th className="border-b p-2">Nome</th>
            <th className="border-b p-2">E-mail</th>
            <th className="border-b p-2">Perfil</th>
            <th className="border-b p-2">Fábricas</th>
          </tr>
        </thead>
        <tbody>
          {usuarios.map((u) => (
            <tr key={u.id}>
              <td className="border-b p-2">{u.nome}</td>
              <td className="border-b p-2">{u.email}</td>
              <td className="border-b p-2">{u.perfil}</td>
              <td className="border-b p-2">{u.fabricas.map((uf) => uf.fabrica.nome).join(", ")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 7: Tela de criação**

`src/app/(app)/cadastros/usuarios/novo/page.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { criarUsuario } from "../actions";

type Fabrica = { id: string; nome: string };

export default function NovoUsuarioPage() {
  const router = useRouter();
  const [erros, setErros] = useState<string[]>([]);
  const [fabricas, setFabricas] = useState<Fabrica[]>([]);

  useEffect(() => {
    fetch("/api/fabricas")
      .then((r) => r.json())
      .then(setFabricas);
  }, []);

  async function handleSubmit(formData: FormData) {
    const resultado = await criarUsuario(formData);
    if (resultado.erros.length > 0) {
      setErros(resultado.erros);
      return;
    }
    router.push("/cadastros/usuarios");
  }

  return (
    <form action={handleSubmit} className="flex max-w-sm flex-col gap-4">
      <h1 className="text-lg font-semibold">Novo usuário</h1>
      <input name="nome" placeholder="Nome" className="rounded border px-3 py-2" required />
      <input name="email" type="email" placeholder="E-mail" className="rounded border px-3 py-2" required />
      <select name="perfil" className="rounded border px-3 py-2">
        <option value="OPERADOR">Operador</option>
        <option value="ANALISTA">Analista</option>
        <option value="ADMIN">Admin</option>
      </select>
      <fieldset className="flex flex-col gap-1">
        <legend className="text-sm font-medium">Fábricas autorizadas</legend>
        {fabricas.map((f) => (
          <label key={f.id} className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="fabricasIds" value={f.id} />
            {f.nome}
          </label>
        ))}
      </fieldset>
      {erros.map((erro) => (
        <p key={erro} className="text-sm text-red-600">{erro}</p>
      ))}
      <button type="submit" className="rounded bg-black px-3 py-2 text-white">Salvar</button>
    </form>
  );
}
```

- [ ] **Step 8: e2e mínimo — proteção de rota**

Em `e2e/smoke.spec.ts`, adicionar:
```ts
test("visitante não logado é redirecionado de /cadastros/usuarios", async ({ page }) => {
  await page.goto("/cadastros/usuarios");
  await expect(page).toHaveURL(/\/login/);
});
```

Run: `npm run e2e`
Expected: PASS.

- [ ] **Step 9: Verificação manual**

Run: `npm run dev` → logado como ADMIN → abrir `/cadastros/usuarios` → convidar um
novo usuário com perfil OPERADOR e 1 fábrica → confirmar e-mail de convite enviado
pelo Supabase → confirmar `EventoAuditoria` da criação. Logar com um usuário não-ADMIN
e confirmar que `/cadastros/usuarios` mostra "Acesso restrito".

- [ ] **Step 10: Commit**

```bash
git add src/domain/cadastro/usuario.ts src/domain/cadastro/__tests__/usuario.test.ts src/app/\(app\)/cadastros/usuarios .env.example e2e/smoke.spec.ts
git commit -m "feat: cadastro de usuários com perfil e permissão por fábrica (ADR-009)"
```

---

## Self-Review (writing-plans)

- **Cobertura:** RF01 (multi-fábrica, Task 6) · RF02 (cadastro de clientes
  multi-fábrica, flags, tipo de confirmação, Task 7) · RF32 (auditoria imutável,
  Tasks 3–4, aplicada em todas as criações) · ADR-009 (perfis + permissão por fábrica,
  Tasks 5, 8) · RN23 (vínculo Cliente×Fábrica independente, Task 7) cobertos.
- **Sem placeholders:** todo step tem código/comando completo; o gate de bootstrap do
  ADMIN (Task 2, Step 6) é manual por natureza (depende de um UID que só existe no
  painel do dono), mas o script e o comando exato estão escritos.
- **Consistência de tipos:** `PerfilUsuario` definido em `src/lib/authz.ts` (Task 5) e
  reusado em `src/lib/sessao.ts`, `src/domain/cadastro/usuario.ts` e nas Server Actions
  (Tasks 6–8). `EventoAuditoriaInput` (Task 3) é o único formato aceito por
  `registrarAlteracoes` (Task 4) e por todas as chamadas de `compararCampos` nas
  telas. `fabricasIds: string[]` tem o mesmo formato em `UsuarioAcesso` (Task 5),
  `UsuarioSessao` (Task 6) e nos validadores de Cliente/Usuário (Tasks 7–8).

## Definition of Done do Épico 2

Cadastrar fábrica e cliente multi-fábrica pela tela; criar usuário (convite por
e-mail) e restringir por fábrica; toda alteração grava `EventoAuditoria`; tela de
Usuários só abre para ADMIN; `npm test` verde (exceto a falha de rede conhecida em
`prisma.test.ts`, se persistir); `npm run e2e` verde.
