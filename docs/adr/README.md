# ADRs — Architecture Decision Records

Decisões tomadas na sessão de brainstorming de **2026-06-22**, resolvendo a seção
§11 ("Decisões e perguntas em aberto") do PRD. Cada ADR é curto: **o que foi decidido
e por quê**.

| ADR | Decisão |
|---|---|
| [ADR-001](ADR-001-stack.md) | Stack: TypeScript full-stack (Next.js + Supabase + Prisma) |
| [ADR-002](ADR-002-saas-custo.md) | Web/SaaS na nuvem, menor custo possível (planos gratuitos) |
| [ADR-003](ADR-003-sem-migracao-mvp.md) | MVP começa do zero — migração das planilhas fica para V2 |
| [ADR-004](ADR-004-vinculo-chamado.md) | Chamado vincula a NFe + itens afetados; nasce sempre de uma NFe |
| [ADR-005](ADR-005-pedido-completo.md) | Item Fora de fab./Desistência conta como resolvido → pedido COMPLETO |
| [ADR-006](ADR-006-prazos-alertas.md) | Alerta sem NFe = 7 dias; chamado crítico = 30 dias; prazos únicos globais |
| [ADR-007](ADR-007-gap-produtos.md) | Painel PEDIDOS × NFE compara só valor de produtos (sem frete/impostos) |
| [ADR-008](ADR-008-estados-nfe.md) | S/NFE é do pedido; estados da NFe; snapshot da qtd pendente |
| [ADR-009](ADR-009-usuarios-permissoes.md) | Multiusuário com perfis e permissão por fábrica desde o MVP |
