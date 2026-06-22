# ADR-003 — MVP começa do zero (sem migração no MVP)

**Data:** 2026-06-22 · **Status:** Aceito

## Decisão
O MVP **não importa** os dados históricos das planilhas. Entram apenas pedidos novos,
cadastrados a partir da entrada em produção. A migração das planilhas Bowden/Autoflex
fica para a **V2** (RF39).

## Por quê
- Entrega mais rápida do fluxo principal, sem o risco de dados sujos das planilhas
  contaminarem o MVP (risco mapeado no PRD §14).
- O histórico antigo continua consultável nas próprias planilhas durante a transição.

## Consequência
Durante a transição, pendências antigas seguem nas planilhas; o sistema vale para o
que entrar a partir do go-live. A migração será um épico próprio na V2, com validação
e saneamento.
