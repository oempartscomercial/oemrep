# Design do MVP — Plataforma de Gestão de Representação Comercial

| | |
|---|---|
| **Status** | Aprovado pelo cliente em 2026-06-22 |
| **Base** | `docs/PRD-master-representacao.md` (PRD Master v1.0) |
| **Método** | Superpowers `brainstorming` → este spec → `writing-plans` |
| **Escopo** | MVP (todos os RF marcados **P0** no PRD §9). V2/V3 mapeados, não detalhados. |

> Este documento é a especificação fechada que orienta o plano de implementação
> (`plans/`). Decisões em aberto do PRD §11 foram resolvidas em sessão de
> brainstorming e estão registradas como ADRs em `docs/adr/`.

---

## 1. Visão de uma frase

Um site (web/SaaS) onde **cada pedido é a entidade central**, as **notas fiscais são
entidades-filhas**, as **divergências viram chamados rastreáveis** e **toda alteração
em pedidos e NFes fica auditada** — substituindo as planilhas Excel por fábrica.

## 2. Arquitetura (em miúdos)

Aplicação web única em **TypeScript** (Next.js) que serve as telas e a lógica de
negócio. Dados em **PostgreSQL (Supabase)**; login, perfis e armazenamento de
arquivos (XML/PDF) também pela Supabase. Acesso ao banco via **Prisma**. Telas com
**Tailwind + shadcn/ui**. Hospedagem **Vercel + Supabase** (planos gratuitos ⇒ custo
~R$ 0/mês no MVP). Stack detalhada e justificada em `docs/adr/ADR-001-stack.md`.

**Princípio de organização:** a lógica de domínio (parsing de NFe, conferência,
máquinas de estado, cálculo de gap, regras de alerta) vive em **funções puras de
TypeScript**, separadas das telas e do banco. Isso é o que torna o TDD viável e o
sistema sustentável por um leigo apoiado pelo agente.

## 3. Modelo de domínio

Entidades (PRD §5) com as decisões fechadas:

| Entidade | Papel | Observações das decisões |
|---|---|---|
| **Fábrica** | Bowden, Autoflex, futuras | flag de conciliação (uso V2) |
| **Cliente** | distribuidor/varejista | atende N fábricas; tratado de forma independente por fábrica (RN23) |
| **Pedido** | entidade central | nº ou `S/N`; ciclo de vida; origem (Excel/manual no MVP); flag arquivado |
| **ItemPedido** | linha do pedido | ref, descrição, qtd pedida, qtd faturada (derivada), qtd pendente (derivada), valor unitário, status. **`qtd_pendente_congelada`** gravada ao virar `FORA DE FABRICAÇÃO`/`DESISTÊNCIA` (ADR-008) |
| **NotaFiscal** | filha do pedido | número, chave de acesso (44 díg.), emitente, destinatário (CNPJ), datas, total produtos, total nota, status de rastreio |
| **ItemFaturado** | ligação item↔NFe | quanto cada NFe faturou de cada item → baixa parcial progressiva (RF09/RN11) |
| **Chamado** | divergência | nasce **de uma NFe** + **itens afetados** (ADR-004); motivos, responsável, status, prazo de inatividade, histórico |
| **Rastreio** | status logístico da NFe | origem do status = manual (MVP) |
| **EventoAuditoria** | log imutável | entidade, id, campo, valor anterior, valor novo, usuário, timestamp |

**Relações-chave:** Fábrica 1→N Cliente/Pedido · Cliente 1→N Pedido · Pedido 1→N
ItemPedido · Pedido 1→N NotaFiscal · **NotaFiscal N↔N Pedido** (nota cobre vários
pedidos do mesmo cliente, RN10) · **ItemPedido N↔N NotaFiscal via ItemFaturado**
(RN11) · NotaFiscal 1→N Chamado · NotaFiscal 1→1 Rastreio.

## 4. Máquinas de estado

**Pedido:** `SEM NFE → PARCIAL → COMPLETO → ARQUIVADO`
- `SEM NFE` na criação; → `PARCIAL` na primeira NFe; → `COMPLETO` quando todos os
  itens estão resolvidos. Item em `FORA DE FABRICAÇÃO`/`DESISTÊNCIA` **conta como
  resolvido** (ADR-005). `ARQUIVADO` é filtro de visualização, reversível (RN17).

**NotaFiscal (rastreio):** `TRÂNSITO → RECEBIDA → ARMAZENADA`, com desvio para
`EXTRAVIADO`. "S/NFE" é situação do **pedido**, não da nota (ADR-008). Cada
transição grava observação + data.

**Chamado:** `ABERTO → EM TRATATIVA → AGUARDANDO → RESOLVIDO`. Vira **crítico** se
ficar **30 dias** (padrão único configurável, ADR-006) sem novo evento, e reaparece
na fila do dia.

## 5. Telas do MVP (P0 do PRD §8)

Dashboard · Lista de pedidos (filtro Em andamento/Concluídos/Arquivados/Todos) ·
Importar pedido (Excel + manual) · **Detalhe do pedido** (abas Itens / Notas fiscais
/ Histórico & auditoria) · **Conferência de NFe** (importa XML → compara item a item
→ divergências destacadas → confirma baixa; suporta NFe que cobre vários pedidos) ·
Rastreio (timeline manual) · **Divergências** (lista + detalhe com thread) · Painel
**PEDIDOS × NFE** (gap por mês/fábrica/cliente, export XLSX) · Central de Alertas ·
Cadastros (Fábricas/Clientes) · Login + gestão de usuários.

## 6. Lógica central testável (foco do TDD)

Funções puras, com testes RED-GREEN-REFACTOR obrigatórios:

1. **Parser de NFe XML** — extrai destinatário (CNPJ), chave de acesso, itens, qtds,
   valores (RF12). Meta: < 5 s.
2. **Conferência automática** — casa NFe × pendências por `CNPJ + referência +
   quantidade + valor unitário`, sinaliza divergências (RF13/RN04).
3. **Baixa progressiva** — recalcula qtd faturada/pendente por item via ItemFaturado
   (RF09/RF15).
4. **Cálculo do gap** — painel PEDIDOS × NFE compara **somente valor de produtos**
   (sem frete/impostos, ADR-007).
5. **Regra de alerta "pedido sem NFe"** — dispara em **7 dias** (padrão único, ADR-006).
6. **Transições de estado** — pedido, NFe e chamado (validação das transições legais).
7. **Snapshot de pendência** — congela `qtd_pendente_congelada` ao resolver item por
   não-faturamento (ADR-008).

## 7. Auditoria e permissões (RNF)

- **Auditoria:** 100% das alterações em pedidos e NFes geram `EventoAuditoria`
  imutável (campo, antes, depois, usuário, timestamp) — RF32.
- **Permissões:** login próprio por usuário; perfis **Operador / Analista / Admin**;
  **acesso por fábrica** desde o MVP (cliente indicou crescimento de equipe, ADR-009).
- **Segredos:** nenhuma credencial de portal externo no MVP (uso V2/V3).

## 8. Escopo

**Entra no MVP (P0):** RF01–RF17, RF20, RF25–RF34 (cadastros, pedidos, ciclo de vida,
conferência XML, NFe↔vários pedidos, item↔várias NFes, rastreio manual, chamados,
painel PEDIDOS×NFE, alerta de pedido sem NFe, auditoria, export XLSX).

**Fora do MVP (mapeado, não detalhado agora — V2/V3):** integrações de rastreio
(API/navegador), OCR de DANFE, conciliação Autoflex, reemissão de NFe, migração das
planilhas históricas, SEFAZ, devoluções, app mobile, central de alertas configurável
avançada.

## 9. Estratégia de testes

- **Unit/integração:** Vitest sobre as funções puras de domínio (seção 6).
- **End-to-end:** Playwright nos fluxos críticos (importar pedido → conferir NFe →
  baixa; abrir chamado; arquivar pedido).
- **Regra de ouro:** nenhum código de produção sem teste que falhe primeiro (RED).

## 10. Estrutura do repositório (a criar no plano)

```
representacao-comercial/
├── CLAUDE.md            # guia do agente + mapa para leigos
├── README.md            # passo a passo do dia a dia (leigo)
├── docs/
│   ├── PRD-master-representacao.md
│   ├── design/2026-06-22-mvp-design.md   (este arquivo)
│   └── adr/             # decisões curtas (o quê + porquê)
├── plans/               # épicos → tarefas de 2-5 min (writing-plans)
├── .claude/
│   ├── agents/          # subagentes (parser NFe, máquinas de estado, revisor)
│   └── settings.json    # hook: roda testes antes de concluir tarefa
└── (código do app — criado na execução do plano)
```

---

### Rastreabilidade RF → seções

RF01–06 → §3,§5 · RF07–11 → §3,§4 · RF12–17 → §6 · RF20 → §4 · RF25–30 → §3,§4 ·
RF31 → §6 (gap) · RF32 → §7 · RF33 → §5 · RF34 → §6. Detalhamento tarefa a tarefa no
`plans/`.
