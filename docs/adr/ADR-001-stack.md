# ADR-001 — Stack técnica: TypeScript full-stack

**Data:** 2026-06-22 · **Status:** Aceito

## Decisão
Adotar **TypeScript** como linguagem única, com **Next.js** (web), **PostgreSQL via
Supabase** (banco + autenticação + storage), **Prisma** (ORM), **Tailwind + shadcn/ui**
(telas), **fast-xml-parser** (NFe XML), **ExcelJS** (export XLSX) e **Vitest +
Playwright** (testes). Hospedagem em **Vercel + Supabase** (planos gratuitos).

## Por quê
- O sistema será mantido por um **leigo apoiado pelo agente**: uma linguagem só,
  popular e muito bem documentada reduz o atrito de manutenção e facilita contratar
  um programador externo se necessário.
- A Supabase entrega banco robusto + login pronto + armazenamento de arquivos no
  **plano gratuito**, atendendo à restrição de **menor custo possível** (ADR-002).
- Next.js + Prisma têm convenções fortes e ótima geração de tipos/migrações, o que
  favorece TDD e a confiabilidade das edições do agente.

## Alternativas consideradas
- **Ruby on Rails** — ótima auditoria (`paper_trail`), mas duas linguagens e
  hospedagem gratuita mais fraca.
- **Python + Django** — bom CRUD/admin, mas parte visual rica fica mais trabalhosa.

## Consequência / pré-requisito
Requer **Node.js** instalado na máquina de desenvolvimento (não há hoje). Instalação
gratuita, guiada no início da execução do plano.
