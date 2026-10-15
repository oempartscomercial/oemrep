# ADR-018 — Prisma com `relationJoins`: uma ida ao banco por consulta com relações

**Data:** 2026-10-14 · **Status:** Aceito

## Contexto
A ficha da empresa levava 8–10 s para abrir em produção e o funil também demorava. Medindo
com 120 ms de ida e volta até o banco (a distância Vercel ↔ Supabase), o tempo era quase todo
de idas ao banco em sequência: sem `relationJoins`, o Prisma resolve cada nível de `include`
/`select` aninhado com uma consulta separada, uma depois da outra. Uma ficha fazia ~26 idas.

## Decisão
1. Ligar o recurso `relationJoins` do Prisma 6 (`previewFeatures` no `schema.prisma`). Cada
   `findMany`/`findUnique` com relações vira **uma** consulta SQL (LATERAL + JSON no Postgres).
   Não muda o modelo de dados nem gera migração.
2. Nas telas, consultas por bloco, só com os campos usados, em paralelo e em `Suspense`;
   `cache()` do React para não repetir a mesma consulta na mesma requisição (inclusive o
   usuário da sessão, que antes ia ao Supabase Auth três vezes por página).

## Consequências
- Medição local com 120 ms de latência (mediana de 5 cargas, `next dev`): ficha com o topo
  em ~0,5 s (antes ~2,8 s), funis em ~0,55 s (antes ~1,4 s), Início com o topo em ~0,4 s
  (antes ~2,9 s). Idas ao banco por ficha: ~26 → ~16–19 (o resto é paralelo).
- É recurso em *preview*: a suíte inteira passou com ele ligado. Se alguma consulta se
  comportar diferente, dá para usar `relationLoadStrategy: "query"` só nela, ou desligar o
  recurso removendo a linha do `schema.prisma` (sem migração).
