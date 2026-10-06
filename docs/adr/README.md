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
| [ADR-010](ADR-010-cadastro-usuario-sem-convite.md) | Cadastro de usuário sem convite por e-mail; vínculo ao login no 1º acesso |
| [ADR-011](ADR-011-design-system-untitled-ui.md) | Untitled UI React (OSS/MIT) como design system oficial — substituído pelo ADR-014 |
| [ADR-012](ADR-012-historico-mensal-agregado.md) | Histórico anterior ao sistema entra como totais mensais agregados |
| [ADR-013](ADR-013-modulo-crm.md) | Módulo de CRM dentro da plataforma, com cadastro único de empresa |
| [ADR-014](ADR-014-shadcn-ui-visual-attio.md) | shadcn/ui como base visual, direção tipo Attio |
