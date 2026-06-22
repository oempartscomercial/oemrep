# ADR-002 — Web/SaaS na nuvem, menor custo possível

**Data:** 2026-06-22 · **Status:** Aceito

## Decisão
O sistema é um **site acessado pelo navegador** (web/SaaS), hospedado na nuvem, com
prioridade para **planos gratuitos** de infraestrutura no MVP.

## Por quê
- O cliente acessa de qualquer computador, com login e senha, e pode dar acesso a
  outros operadores (a equipe vai crescer — ADR-009).
- Backup automático e disponibilidade ficam por conta do provedor (Supabase/Vercel).
- Restrição declarada: **menor custo possível** — Vercel + Supabase no plano gratuito
  cobrem o MVP a ~R$ 0/mês, com caminho de upgrade pago só quando o volume justificar.

## Alternativas consideradas
- **Instalação local no PC** — mais privado, porém difícil de compartilhar entre
  operadores e de garantir backup; descartado pelo crescimento previsto da equipe.
