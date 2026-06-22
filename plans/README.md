# Plano de Implementação — Roteiro do MVP

> **Para quem executa (agente):** use `superpowers:subagent-driven-development`
> (recomendado) ou `superpowers:executing-plans` para implementar tarefa a tarefa.
> Antes de iniciar **cada** épico, use `superpowers:writing-plans` para expandir o
> brief do épico em tarefas bite-sized (2-5 min) com código completo e verificação.

**Base:** `docs/design/2026-06-22-mvp-design.md` + ADRs em `docs/adr/`.

## Como este plano funciona (protocolo detalhar-então-executar)

O MVP tem 7 épicos. O **Épico 1 (Fundação)** já está totalmente detalhado em
`2026-06-22-epic-01-fundacao.md`. Os épicos 2 a 7 estão como **briefs** em
`2026-06-22-epics-02-07-briefs.md` — cada um é expandido em tarefas bite-sized
**imediatamente antes** de ser executado, porque o código concreto depende das
fundações já no lugar. Isso mantém o plano fiel à realidade em vez de virar ficção.

**Regra de ouro em toda tarefa:** TDD (RED → GREEN → REFACTOR), YAGNI, DRY, commits
frequentes, nenhuma alteração de dado sem auditoria. Ver `CLAUDE.md`.

## Ordem de release (MVP primeiro)

| # | Épico | Entrega (software testável) | RFs cobertos |
|---|---|---|---|
| 1 | **Fundação** | Projeto roda, testes rodam, login funciona, padrão TDD estabelecido | base p/ todos |
| 2 | **Cadastros & Acesso** | Fábricas, Clientes (multi-fábrica), usuários/perfis/permissão por fábrica | RF01, RF02, RF32(parc.), RNF acesso |
| 3 | **Pedidos** | Criar pedido (Excel+manual+`S/N`), itens, ciclo de vida, lista+filtros, detalhe | RF03–RF11, RF06 |
| 4 | **Conferência de NFe** | Parser XML, conferência item a item, baixa progressiva, NFe↔vários pedidos, cruzamento | RF12–RF17 |
| 5 | **Rastreio** | Status logístico manual da NFe + timeline | RF20 |
| 6 | **Divergências** | Chamado a partir da NFe, motivos, itens afetados, histórico, alerta de inatividade | RF25–RF30 |
| 7 | **Análise, Alertas & Auditoria** | Painel PEDIDOS×NFE, alerta sem NFe, dashboard, auditoria completa, export XLSX | RF31–RF34 |

## Matriz de rastreabilidade RF (P0) → épico

```
RF01 Multi-fábrica .................... Épico 2
RF02 Cadastro de clientes ............. Épico 2
RF03 Upload pedido Excel .............. Épico 3
RF04 Cadastro manual de pedido ........ Épico 3
RF05 Pedido S/N ....................... Épico 3
RF06 Listagem de itens pendentes ...... Épico 3
RF07 Ciclo de vida do pedido .......... Épico 3
RF08 Detalhe do pedido com NFes-filhas  Épico 3 (telas) / 4 (vínculo NFe)
RF09 Item atendido por várias NFes .... Épico 4
RF10 Arquivamento reversível .......... Épico 3
RF11 Status de item ................... Épico 3
RF12 Upload e parsing de NFe XML ...... Épico 4
RF13 Conferência automática ........... Épico 4
RF14 NFe cobre múltiplos pedidos ...... Épico 4
RF15 Confirmação manual da baixa ...... Épico 4
RF16 Tela de conferência editável ..... Épico 4
RF17 Relatório de cruzamento por NFe .. Épico 4
RF20 Ciclo de status da NFe ........... Épico 5
RF25 Abrir chamado a partir da NFe .... Épico 6
RF26 Motivos de divergência ........... Épico 6
RF27 Página dedicada de divergências .. Épico 6
RF28 Histórico do chamado ............. Épico 6
RF29 Alerta de inatividade ............ Épico 6
RF30 Itens afetados no chamado ........ Épico 6
RF31 Painel PEDIDOS × NFE ............. Épico 7
RF32 Log de auditoria ................. Épico 2 (infra) + transversal
RF33 Exportação para Excel ............ Épico 7
RF34 Alerta de pedido sem NFe ......... Épico 7
```

## Definition of Done (resumo — detalhe em CLAUDE.md)

- **Por tarefa:** teste escrito primeiro e visto falhar → código mínimo → teste passa
  → commit. Sem código sem teste.
- **Por épico:** todos os RFs do épico cobertos por teste; fluxo principal demonstrável
  numa tela; `npm test` verde; revisão em duas etapas (conformidade + qualidade) ok.
