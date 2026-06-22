# ADR-008 — Estados da NFe e snapshot da quantidade pendente

**Data:** 2026-06-22 · **Status:** Aceito · Resolve PRD §11.1 (4) e detalhe de itens

## Decisão
1. **"S/NFE" é situação do PEDIDO**, não da nota. O pedido fica `SEM NFE` enquanto não
   há nota; a `NotaFiscal`, ao ser criada, nasce em **TRÂNSITO**.
2. **Estados de rastreio da NotaFiscal:** `TRÂNSITO → RECEBIDA → ARMAZENADA`, com
   desvio para `EXTRAVIADO`. (Lista confirmada pelo cliente a partir das planilhas;
   o estado "EM FABRICAÇÃO" que havia sido proposto na modelagem foi descartado.)
3. **Snapshot de pendência:** ao marcar um item como `FORA DE FABRICAÇÃO` ou
   `DESISTÊNCIA`, o sistema **grava `qtd_pendente_congelada`** com o saldo pendente
   daquele instante (não zera a informação).

## Por quê
- Separar pedido e nota evita duplicar a noção de "sem nota". O rastreio só faz
  sentido quando a nota existe (ou seja, já em trânsito).
- O snapshot preserva, para auditoria e histórico, *quanto* faltava quando o item foi
  resolvido por não-faturamento — exigência explícita do cliente.

## Consequência
- `Pedido.situacao` cobre `SEM NFE`; `Rastreio.status` cobre TRÂNSITO/RECEBIDA/
  ARMAZENADA/EXTRAVIADO.
- `ItemPedido.qtd_pendente_congelada` (nullable) é preenchido na transição para
  `FORA DE FABRICAÇÃO`/`DESISTÊNCIA` e registrado em `EventoAuditoria`.
