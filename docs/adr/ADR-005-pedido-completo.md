# ADR-005 — "Completo" inclui itens não faturados

**Data:** 2026-06-22 · **Status:** Aceito · Resolve PRD §11.1 (3)

## Decisão
Um pedido cujos itens restantes estão em `FORA DE FABRICAÇÃO` ou `DESISTÊNCIA`
(nunca serão faturados) é considerado **COMPLETO** e pode ser **arquivado**. Esses
status "resolvem" o item para fins de ciclo de vida.

## Por quê
- Confirma a premissa do PRD. Mantém a tela operacional limpa: pedidos sem nada mais
  a fazer saem do "Em andamento".
- Evita pedidos presos para sempre por um item que a fábrica descontinuou.

## Consequência
A transição para `COMPLETO` ocorre quando **todo** item está `OK`, `FORA DE
FABRICAÇÃO` ou `DESISTÊNCIA`. Ver ADR-008 para o registro do saldo pendente no
momento da resolução por não-faturamento.
