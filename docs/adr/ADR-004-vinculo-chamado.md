# ADR-004 — Vínculo e origem do chamado de divergência

**Data:** 2026-06-22 · **Status:** Aceito · Resolve PRD §11.1 (1) e (2)

## Decisão
1. O **chamado vincula-se à NotaFiscal + aos itens afetados** dela.
2. O **chamado nasce sempre a partir de uma NotaFiscal** (não diretamente do pedido).

## Por quê
- Vincular à NFe + itens dá o contexto completo do problema (qual nota, qual item)
  sem complicar o modelo — confirma a premissa do PRD.
- Restringir a origem à NFe mantém o MVP enxuto; o caso de "reclamação cruza várias
  notas" é raro e pode ser reavaliado depois.

## Consequência
Modelo: `Chamado` referencia uma `NotaFiscal` (origem) e uma lista de `ItemPedido`/
`ItemFaturado` afetados. Não há, no MVP, abertura de chamado a partir do pedido.
