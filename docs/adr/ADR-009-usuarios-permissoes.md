# ADR-009 — Multiusuário com perfis e permissão por fábrica no MVP

**Data:** 2026-06-22 · **Status:** Aceito · Resolve PRD §11.3 (operadores)

## Decisão
O MVP já nasce **multiusuário**, com login próprio por pessoa, **perfis** (Operador /
Analista / Admin) e **controle de acesso por fábrica**.

## Por quê
- O cliente indicou que serão **mais de 3 usuários e a equipe vai crescer**, possivelmente
  com divisão por fábrica.
- Adicionar perfis/permissões depois, com dados já em produção, é mais caro do que já
  nascer com a estrutura.

## Consequência
- Autenticação via Supabase Auth; tabela de `Usuario` com `perfil` e vínculo às
  fábricas autorizadas.
- As telas e ações checam perfil + fábrica. 2FA fica como melhoria pós-MVP (RNF §12).
