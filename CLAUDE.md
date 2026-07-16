# CLAUDE.md — Guia do agente para este repositório

> Este arquivo é lido automaticamente pelo Claude Code ao abrir o projeto. Ele diz ao
> agente **como se comportar aqui**. O dono do projeto é **leigo em programação** e
> conduz o desenvolvimento conversando em português. Trate cada pedido em linguagem
> natural como uma tarefa séria de engenharia.

---

## 1. O que é este produto

**Visão de uma frase:** um site (web/SaaS) de gestão de representação comercial onde
**cada pedido é a entidade central**, as **notas fiscais são filhas** do pedido, as
**divergências viram chamados rastreáveis** e **toda alteração fica auditada** —
substituindo as planilhas Excel por fábrica (Bowden, Autoflex e futuras).

**Estado atual do desenvolvimento:** **Épicos 1, 2, 3, 4 e 5 concluídos.**
- **Épico 1 — Fundação** (`plans/2026-06-22-epic-01-fundacao.md`): Next.js + TypeScript +
  Tailwind, Vitest + Playwright, Prisma + Postgres (Supabase) com parâmetros padrão,
  autenticação Supabase Auth com proteção de rotas, casca do app com navegação.
- **Épico 2 — Cadastros & Acesso** (`plans/2026-06-26-epico-02-cadastros-acesso.md`):
  CNPJ validado (domínio puro), schema de Fábrica/Cliente/Usuário/auditoria, regra de
  acesso por fábrica (ADR-009), telas de Fábricas, Clientes (multi-fábrica) e Usuários
  (perfil + permissão por fábrica). Cadastro de usuário **sem convite por e-mail**
  (ADR-010): cria o registro e vincula ao login Supabase no 1º acesso, pelo e-mail.
  Primeiro ADMIN criado via `prisma/bootstrap-admin.ts`.
- **Épico 3 — Pedidos** (`plans/2026-07-04-epico-03-pedidos.md`): shadcn/ui como base
  visual do app; schema de `Pedido`/`ItemPedido` com ciclo de vida
  (`SEM_NFE → PARCIAL → COMPLETO → ARQUIVADO`, ADR-005) e snapshot de pendência
  congelada por não-faturamento (ADR-008); criação manual de pedido com `S/N`;
  importação de pedido via planilha Excel (upload → revisão → confirmação); lista com
  filtros por situação; tela de detalhe com abas (Itens/Notas fiscais/Histórico),
  atualização de status de item e arquivamento/reabertura reversível. `SKIP_AUTH`
  agora liga no proxy de autenticação, para navegação manual sem login em dev local
  (a suíte e2e força `SKIP_AUTH=false`).
- **Épico 4 — Conferência de NFe** (`plans/2026-07-04-epico-04-conferencia-nfe.md`):
  parser de XML de NFe (`fast-xml-parser`); conferência item a item por CNPJ +
  referência + quantidade + valor unitário (RN04); baixa parcial progressiva de item
  por várias NFes (RF09/RN11); vínculo de uma NFe a vários pedidos do mesmo cliente
  (RN10, `NotaFiscalPedido`); schema de `NotaFiscal`/`ItemFaturado`; tela de
  conferência com upload → grade de divergências → confirmação manual da baixa
  (RF15/RF16); relatório de cruzamento por NFe e aba "Notas fiscais" no detalhe do
  pedido (RF17).
- **Épico 5 — Rastreio de NFe** (`plans/2026-07-11-epico-05-rastreio.md`): máquina de
  estado logística da NFe (`TRANSITO → RECEBIDA → ARMAZENADA`, desvio `EXTRAVIADO`,
  ADR-008) em `src/domain/nfe/rastreio.ts`; schema `EventoRastreio` (histórico de
  transições com observação, data do evento e usuário); atualização manual de status
  via `avancarRastreio` com auditoria (`EventoAuditoria`) em toda mudança de
  `NotaFiscal.status`; telas `/rastreio` (lista) e `/rastreio/[id]` (detalhe com
  timeline e formulário de avanço) (RF20).
- **Design System — Untitled UI** (`docs/adr/ADR-011`,
  `docs/superpowers/plans/2026-07-15-untitled-ui-design-system.md`): **Untitled UI React
  OSS (MIT)** substitui o shadcn/ui como fonte visual única. Identidade da OEM (grafite +
  vermelho, só tema claro) em `src/styles/theme.css`; componentes em
  `src/components/{ui,application,patterns,layouts}` (React Aria); todas as 18 telas
  migradas; catálogo em `/design-system`; guia em `DESIGN_SYSTEM.md`. Regras/rotas/APIs/
  permissões/estados/auditoria preservadas.

Próximo passo: expandir e executar o **Épico 6**
(`plans/2026-06-22-epics-02-07-briefs.md`). Mantenha esta seção atualizada conforme os
épicos forem concluídos.

## 2. Como o agente deve trabalhar aqui (fases × skills do Superpowers)

Use as skills do Superpowers em cada fase. **Sempre verifique se uma skill se aplica
antes de agir.**

| Fase | Skill | Quando |
|---|---|---|
| Entender/decidir | `brainstorming` | Antes de qualquer feature nova ou decisão de produto ainda em aberto |
| Isolar trabalho | `using-git-worktrees` | Antes de começar a implementar um épico |
| Planejar | `writing-plans` | Para expandir o **brief** de um épico (2–7) em tarefas bite-sized antes de executá-lo |
| Executar | `subagent-driven-development` (recom.) ou `executing-plans` | Implementar tarefa a tarefa, com revisão em duas etapas |
| Implementar com disciplina | `test-driven-development` | Em **toda** tarefa de código (RED → GREEN → REFACTOR) |
| Investigar bug | `systematic-debugging` | Diante de qualquer falha de teste ou comportamento inesperado |
| Revisar | `requesting-code-review` / `receiving-code-review` | Entre tarefas e antes de integrar |
| Verificar | `verification-before-completion` | Antes de afirmar que algo está pronto |
| Fechar | `finishing-a-development-branch` | Quando o épico termina e os testes passam |

**Fluxo padrão de um épico:** `using-git-worktrees` → `writing-plans` (expandir brief)
→ `subagent-driven-development` (com `test-driven-development` em cada tarefa) →
`requesting-code-review` → `verification-before-completion` → `finishing-a-development-branch`.

> Os subagentes especializados deste projeto estão em `.claude/agents/` (parser de NFe,
> máquinas de estado, revisor de domínio). Use-os quando a tarefa casar.

## 3. Stack aprovada e convenções

- **Linguagem única:** TypeScript (strict). **Web:** Next.js (App Router, `src/`).
- **Banco:** PostgreSQL (Supabase) via **Prisma**. **Auth:** Supabase Auth.
- **Telas:** Tailwind v4 + **Untitled UI React OSS/MIT** (React Aria) — ver ADR-011 e
  `DESIGN_SYSTEM.md`. shadcn/ui foi removido. **XML NFe:** fast-xml-parser. **XLSX:** ExcelJS.
- **Testes:** Vitest (unidade/integração) + Playwright (e2e).
- **Hospedagem:** Vercel + Supabase (planos gratuitos).

**Convenções de arquitetura:**
- **Lógica de domínio em funções puras** sob `src/domain/`, sem importar Next/Prisma/
  Supabase. É onde o TDD acontece e onde moram as regras (estados, conferência, gap,
  alertas, snapshot de pendência).
- Telas (`src/app/`) e acesso a dados (`src/lib/`, Prisma) são finos e chamam o domínio.
- Arquivos pequenos e focados (uma responsabilidade). Nomes em português no domínio
  (combina com o vocabulário do negócio).
- Decisões de arquitetura têm ADR em `docs/adr/`. Mudou algo estrutural? Escreva um ADR.

## 4. Modelo de domínio (resumo)

```
Fábrica 1─N Cliente   ·   Fábrica 1─N Pedido   ·   Cliente 1─N Pedido
Pedido  1─N ItemPedido
Pedido  1─N NotaFiscal      ·   NotaFiscal N─N Pedido   (nota cobre vários pedidos)
ItemPedido N─N NotaFiscal   via ItemFaturado            (item por várias NFes)
NotaFiscal 1─N Chamado      ·   NotaFiscal 1─1 Rastreio
EventoAuditoria → qualquer entidade (imutável)
```

**Estados:**
- Pedido: `SEM_NFE → PARCIAL → COMPLETO → ARQUIVADO` (item Fora de fab./Desistência
  conta como resolvido — ADR-005).
- NFe (rastreio): `TRANSITO → RECEBIDA → ARMAZENADA`, desvio `EXTRAVIADO` (S/NFE é do
  pedido — ADR-008).
- Chamado: `ABERTO → EM_TRATATIVA → AGUARDANDO → RESOLVIDO` (crítico após 30 dias sem
  evento — ADR-006).

## 5. Regras de ouro inegociáveis

1. **TDD sempre.** Escreva o teste, veja-o **falhar** (RED), implemente o mínimo
   (GREEN), refatore. **Nenhum código de produção sem um teste que falhou antes.**
   Código escrito antes do teste deve ser apagado e refeito via TDD.
2. **YAGNI.** Só construa o que o épico atual exige. Nada de feature especulativa.
3. **DRY.** Não repita regra de negócio; centralize no domínio.
4. **Auditoria de 100%.** Toda alteração de dados em **pedidos e NFes** grava
   `EventoAuditoria` (campo, valor anterior, valor novo, usuário, timestamp).
5. **Decisões do cliente mandam.** Os ADRs em `docs/adr/` são a fonte de verdade das
   regras de produto. Conflito entre seu palpite e um ADR → o ADR vence (ou abra
   `brainstorming` para mudá-lo com o cliente).
6. **Commits pequenos e frequentes**, um por tarefa concluída.

## 6. Mapa para leigos 🗺️

**O que cada pasta significa:**
- `docs/` — a "verdade" do projeto: o PRD, o design e as decisões (ADRs). **Leitura, não código.**
- `plans/` — a lista de tarefas. `README.md` é o roteiro; `epic-01` está pronto; os
  demais épicos são "briefs" que viram tarefas detalhadas na hora de fazer.
- `src/` — o código do sistema (criado a partir do Épico 1).
- `.claude/` — ajudantes do agente (subagentes e o hook que roda os testes).

**O que você NUNCA precisa mexer à mão:**
- Qualquer coisa em `src/`, `prisma/`, arquivos `.ts`, `.tsx`, `.json`, `.prisma`.
- O arquivo `.env` (segredos) — você só cola as chaves quando o agente pedir.
- Nada de editar código direto. **Sempre peça ao agente.**

**Como pedir as coisas (exemplos em linguagem natural):**
- "Vamos começar o Épico 1." / "Continua de onde paramos."
- "Quero adicionar uma nova fábrica chamada X." (depois do Épico 2)
- "Apareceu um erro na tela de conferência, dá uma olhada."
- "Explica em palavras simples o que essa tarefa faz."
- "Antes de seguir, me mostra o que mudou e por quê."

**Como aprovar um checkpoint:** o agente vai descrever o resultado sem jargão —
ex.: *"Isto cria a tela de login; você consegue abrir o site e entrar com e-mail e
senha. Pode seguir?"*. Você responde "pode seguir" ou aponta o que está estranho.

## 7. Definition of Done

**Por tarefa:** teste escrito e visto falhar → código mínimo → teste passa → revisão
(conformidade com a spec, depois qualidade) → commit. Sem código sem teste.

**Por épico:** todos os RFs do épico cobertos por teste; fluxo principal demonstrável
numa tela; `npm test` (e `npm run e2e` quando houver) verdes; auditoria funcionando;
`finishing-a-development-branch` executado.

## 8. Glossário de domínio

| Termo | Significado |
|---|---|
| **Representação comercial** | Empresa que intermedeia vendas entre fábricas e clientes, sem estocar mercadoria |
| **Pedido** | Solicitação de compra de um cliente; entidade central do sistema |
| **NFe** | Nota fiscal eletrônica emitida pela fábrica |
| **DANFE** | Representação em PDF da NFe (OCR só na V2) |
| **Chave de acesso** | Identificador único da NFe (44 dígitos, padrão SEFAZ) |
| **S/N** | Pedido sem número interno do cliente |
| **Faturamento parcial** | Fábrica fatura só parte de um pedido em uma NFe |
| **Baixa progressiva** | Item atendido por várias NFes ao longo do tempo (via ItemFaturado) |
| **Divergência / Chamado** | Registro estruturado de um problema reportado sobre uma NFe |
| **Gap de faturamento** | Diferença entre o valor pedido e o já faturado (só produtos — ADR-007) |
| **Conciliação** | Comparar pendências da plataforma com o sistema interno da fábrica (Autoflex, V2) |
| **CCe** | Carta de Correção Eletrônica de uma NFe (V3) |
| **SLA** | Prazo aceitável entre dois eventos (ex.: pedido → NFe = 7 dias, ADR-006) |

## 9. Onde olhar primeiro

1. `plans/README.md` — roteiro e ordem dos épicos.
2. `plans/2026-06-22-epic-01-fundacao.md` — o que executar agora.
3. `docs/adr/` — as regras de produto que não podem ser violadas.
4. `docs/design/2026-06-22-mvp-design.md` — o design completo do MVP.
