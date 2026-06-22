# ADR-006 — Prazos de alerta (únicos e globais no MVP)

**Data:** 2026-06-22 · **Status:** Aceito · Resolve PRD §11.1 (5) e (6)

## Decisão
- **Alerta de "pedido sem NFe":** dispara após **7 dias** sem nenhuma nota.
- **Chamado crítico por inatividade:** **30 dias** sem novo evento.
- Ambos os prazos são **únicos e globais** no MVP (um valor para todas as fábricas e
  motivos), **configuráveis** numa tela de parâmetros.

## Por quê
- Cliente optou por cobrança mais ágil da fábrica (7 dias).
- Prazo único mantém o MVP simples (YAGNI). Variação por fábrica (PRD §11.1.6) ou por
  motivo de chamado (PRD §11.1.5) pode entrar depois sem retrabalho grande, pois o
  valor já nasce parametrizável.

## Consequência
Tabela de parâmetros do sistema com `prazo_alerta_sem_nfe_dias = 7` e
`prazo_chamado_critico_dias = 30`. A regra de alerta lê desses parâmetros.
