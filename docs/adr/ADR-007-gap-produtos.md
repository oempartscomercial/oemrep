# ADR-007 — Gap do painel compara só valor de produtos

**Data:** 2026-06-22 · **Status:** Aceito · Resolve PRD §11.2 (valor no painel)

## Decisão
No painel **PEDIDOS × NFE**, o gap de faturamento compara o **valor dos produtos** do
pedido com o **valor dos produtos** da nota (campo "total de produtos"), **excluindo
frete e impostos**.

## Por quê
- O valor do pedido é só produtos (não há frete/imposto no pedido). Comparar com o
  "total da nota" (que inclui frete/impostos) distorceria o gap.
- Comparação justa: produtos × produtos.

## Consequência
O cálculo do gap usa `NotaFiscal.total_produtos` (não `total_nota`). O `total_nota`
ainda é armazenado para conferência, mas não entra no gap.
