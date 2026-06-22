# PRD Master — Plataforma de Gestão de Representação Comercial

| | |
|---|---|
| **Produto** | Sistema de acompanhamento de pedidos × notas fiscais para representação comercial multi-fábrica |
| **Versão do documento** | 1.0 |
| **Data** | 22/06/2026 |
| **Status** | Em definição — base para detalhamento de épicos e backlog |
| **Fontes** | Diagnóstico v1.0 (descrição oral) · Diagnóstico v2.0 (planilhas Bowden e Autoflex) · sessão de modelagem do fluxo operacional · wireframe navegável v2.0 |
| **Escopo deste documento** | Visão de produto, modelo de domínio, requisitos funcionais e não funcionais, regras de negócio, fluxos e estratégia de release. Não cobre arquitetura técnica detalhada nem especificação de API. |

---

## 1. Resumo executivo

A empresa atua como **representante comercial** de fábricas (hoje **Bowden** e **Autoflex**, com previsão de novas) junto a uma carteira de clientes distribuidores e varejistas de autopeças. O trabalho central é garantir que cada pedido de um cliente seja faturado corretamente pela fábrica — cliente certo, produto certo, quantidade e valor corretos — e que a mercadoria chegue ao estoque do cliente, dando **rastreabilidade e controle de ponta a ponta**: do pedido recebido até a mercadoria armazenada, passando pela conferência da NFe e pela tratativa de qualquer divergência.

Hoje o processo roda inteiramente em **planilhas Excel separadas por fábrica**, com lançamento manual item a item em múltiplas abas, conferência visual de NFe, rastreio manual e tratativas registradas em texto livre. O volume já passa de **15.900 itens históricos** e **1.600 itens pendentes ativos**, o que torna o controle frágil, dependente de pessoas e sem auditoria.

A plataforma proposta substitui as planilhas por um sistema web onde o **pedido é a entidade central**, as **notas fiscais são entidades-filhas** (um pedido pode ter várias NFes; um item pode ser atendido por várias NFes), as **divergências viram chamados rastreáveis** com histórico e alertas, e o **rastreio logístico é integrado** às transportadoras. O objetivo é eliminar lançamento manual redundante, detectar divergências automaticamente e nunca perder de vista um pedido sem faturamento, uma NFe parada ou um chamado sem tratativa.

---

## 2. Problema e contexto

### 2.1 Como funciona hoje (AS IS)

O ciclo manual atual tem cinco etapas, repetidas em duas planilhas (uma por fábrica):

1. **Registro do pedido** — recebido por e-mail (PDF ou Excel), lançado manualmente.
2. **Lançamento dos itens** — cada item transcrito linha a linha com referência, quantidade e valor unitário.
3. **Conferência da NFe** — NFe recebida (XML ou DANFE) conferida visualmente contra os itens pendentes; baixa total ou parcial.
4. **Rastreio da NFe** — status logístico atualizado manualmente; para clientes sem acesso ao sistema, "armazenada" é presumida.
5. **Confronto pedidos × NFes** — totais lançados manualmente por mês/ano.

A Autoflex tem ainda uma **etapa extra de conciliação** com o sistema interno da fábrica, registrada em texto livre.

### 2.2 Dores principais

- **Trabalho manual excessivo e duplicado** — um pedido de 30 itens pode exigir mais de 100 lançamentos ao longo do ciclo; os mesmos dados (CNPJ, fantasia, nº do pedido, valores) são reescritos em três ou mais abas.
- **Sem alertas de divergência** — a conferência depende de atenção humana; divergências de quantidade, valor ou destinatário passam despercebidas.
- **Casos complexos sem estrutura** — "NFe cobre vários pedidos", "item atendido por várias NFes", "NFe cancelada e reemitida", "NFe bloqueada pelo SEFAZ" são tratados com notações textuais informais (`/`, `->`, observações livres).
- **Tratativas de divergência sem rastreabilidade** — quando o cliente reporta nota errada, item faltando ou quebrado, não há registro estruturado de motivo, histórico ou prazo.
- **Estoque presumido** — status "armazenada" sem confirmação real para parte dos clientes.
- **Sem auditoria** — qualquer alteração na planilha sobrescreve o dado anterior, sem histórico de quem, quando e por quê.
- **Volume sem escala** — 15.900+ itens dificultam consulta e localização.
- **Risco financeiro invisível** — o gap entre pedidos e faturamento só aparece consolidado (ex.: jun/2026, Bowden, R$ 129k de diferença), sem detalhe por cliente ou item.
- **Conhecimento implícito** — convenções e atalhos vivem na cabeça dos operadores.

### 2.3 Escala atual (confirmada pelas planilhas)

| Fábrica | Itens históricos | Itens pendentes | NFes rastreadas | Clientes ativos | Pedidos 2026 | NFes 2026 |
|---|---|---|---|---|---|---|
| Bowden | 7.515 | 506 | 275 | 45 | R$ 2,45M | R$ 1,84M |
| Autoflex | 8.430 | 1.098 | 691 | 24 | R$ 2,23M | R$ 2,13M |
| **Total** | **15.945** | **1.604** | **966** | **~69** | **R$ 4,68M** | **R$ 3,97M** |

---

## 3. Objetivos e não-objetivos

### 3.1 Objetivos do produto

1. **Centralizar** todo o ciclo pedido → NFe → entrega → tratativa em uma única plataforma multi-fábrica.
2. **Eliminar o lançamento manual redundante** via importação automática de pedidos e NFes.
3. **Detectar divergências automaticamente** na conferência da NFe (quantidade e valor unitário).
4. **Garantir que nada seja esquecido** — pedido sem NFe, NFe parada em trânsito, chamado sem atualização — através de alertas proativos.
5. **Dar auditoria completa** — histórico imutável de toda alteração em pedidos e NFes.
6. **Estruturar os casos complexos** (NFe ↔ múltiplos pedidos, item ↔ múltiplas NFes, reemissão, divergências) em dados, não em texto livre.
7. **Tornar o gap financeiro visível** por fábrica, cliente e item, não só consolidado.

### 3.2 Não-objetivos (nesta fase)

- Não é um ERP nem um sistema fiscal — não emite NFe, não calcula impostos, não substitui a contabilidade.
- Não gerencia o estoque próprio da representação (a empresa não estoca mercadoria).
- Não substitui o sistema interno das fábricas — apenas concilia com ele (caso Autoflex).
- Não é um CRM de vendas — o foco é o pós-pedido (faturamento e entrega), não a prospecção.

### 3.3 Métricas de sucesso

| Métrica | Baseline (planilha) | Meta |
|---|---|---|
| Tempo de lançamento de um pedido de 20 itens | ~minutos de digitação manual | < 1 min (upload + revisão) |
| Tempo de conferência de uma NFe | conferência visual manual | < 3 etapas após upload do XML |
| Divergências de valor detectadas | dependentes de atenção humana | 100% sinalizadas automaticamente |
| Pedidos sem NFe não monitorados | risco de esquecimento | 0 — todos com alerta por SLA |
| Chamados de divergência sem tratativa | sem controle | 0 críticos sem alerta de inatividade |
| Rastreabilidade de alterações | inexistente | 100% das alterações auditadas |

---

## 4. Personas e usuários

| Perfil | Descrição | Principais ações no sistema |
|---|---|---|
| **Operador** | Executa o processo diário | Cadastra/importa pedidos, importa NFes, executa conferência, atualiza status de rastreio, abre e trata chamados de divergência, registra observações |
| **Analista / Supervisor** | Monitora indicadores e exceções | Visualiza dashboards e o painel pedidos × NFe, acompanha alertas e chamados críticos, exporta relatórios, revisa divergências |
| **Administrador** | Gerencia o sistema | Cadastra fábricas e clientes, gerencia usuários e permissões (por módulo e por fábrica), configura parâmetros de alerta, executa migração de dados |
| **Consulta** *(futuro)* | Visualiza sem alterar | Acompanha status de pedidos e NFes sem permissão de edição |

---

## 5. Modelo de domínio

### 5.1 Entidades principais

O sistema gira em torno de duas entidades centrais — **Pedido** e **Nota Fiscal** — e suas relações.

```
Fábrica 1 ──── N Cliente   (cliente pode atender a mais de uma fábrica)
Fábrica 1 ──── N Pedido
Cliente 1 ──── N Pedido

Pedido  1 ──── N ItemPedido
Pedido  1 ──── N NotaFiscal          (faturamento parcial → várias NFes por pedido)
NotaFiscal N ── N Pedido             (uma NFe pode cobrir vários pedidos do mesmo cliente)

ItemPedido N ── N NotaFiscal         (um item pode ser atendido por várias NFes — baixa parcial progressiva)
   └── via ItemFaturado (qtd faturada por NFe)

NotaFiscal 1 ── N Chamado            (divergência sempre nasce de uma NFe)
NotaFiscal 1 ── 1 Rastreio           (status logístico + integração transportadora)
NotaFiscal 0..1 ── NotaFiscal        (vínculo de reemissão: original -> substituta)
```

### 5.2 Detalhe das entidades

**Fábrica** — representada pela empresa. Atributos: nome, CNPJ, flag de conciliação com sistema interno (Autoflex = sim), credenciais de portal (criptografadas, uso futuro).

**Cliente** — distribuidor/varejista. Atributos: CNPJ, nome fantasia, fábricas que atende, flag de acesso ao sistema interno, tipo de confirmação de estoque (automática | presumida), credenciais de portal (criptografadas, uso futuro).

**Pedido** — entidade central. Atributos: fábrica, cliente, número do pedido (ou `S/N`), data de recebimento, valor total, situação (ver máquina de estados), origem (upload Excel | upload PDF | manual), flag de arquivado.

**ItemPedido** — linha do pedido. Atributos: referência, descrição, quantidade pedida, quantidade faturada (derivada), quantidade pendente (derivada), valor unitário, situação do item (`PENDENTE` | `OK` | `FORA DE FABRICAÇÃO` | `DESISTÊNCIA`).

**NotaFiscal** — entidade-filha do pedido. Atributos: número, chave de acesso, emitente, destinatário (CNPJ), data de emissão, total de produtos, total da nota, status logístico (ver máquina de estados), vínculo de reemissão, observação.

**ItemFaturado** — tabela de ligação que materializa o "item atendido por várias NFes": referência ao ItemPedido, à NotaFiscal e a quantidade faturada naquela nota. É o que permite baixa parcial progressiva e o histórico de quanto cada NFe atendeu de cada item.

**Chamado (Divergência)** — entidade própria, criada a partir de uma NFe. Atributos: NFe de origem, pedido relacionado, cliente, motivo(s), itens afetados, responsável, status, data de abertura, prazo de inatividade configurável, histórico de eventos.

**Rastreio** — estado logístico da NFe. Atributos: transportadora, código de rastreio, status atual, origem do status (API | navegador/Playwright | manual), data da última consulta.

**EventoAuditoria** — registro imutável aplicável a qualquer entidade: tipo de entidade, id, campo alterado, valor anterior, valor novo, usuário, timestamp.

### 5.3 Máquina de estados — Pedido

```
        criação
           │
           ▼
      [ SEM NFE ] ───────────────► (alerta se passar do SLA sem NFe)
           │  primeira NFe emitida
           ▼
      [ PARCIAL ] ◄──── enquanto houver item pendente
           │  todos os itens resolvidos (OK / Fora de fab. / Desistência)
           ▼
      [ COMPLETO ]
           │  ação do operador
           ▼
      [ ARQUIVADO ]   (oculto da tela operacional; reabrível para consulta)
```

- O **tempo de vida** do pedido termina quando **todos os itens pendentes foram resolvidos** — seja por faturamento integral (`OK`), seja por `FORA DE FABRICAÇÃO` ou `DESISTÊNCIA`. Nesse ponto o pedido fica **COMPLETO**.
- O **arquivamento** é uma ação para tirar o pedido da tela operacional (que mostra o que está em andamento). É um filtro, não uma exclusão: qualquer pedido arquivado pode ser reexibido a qualquer momento para consulta de histórico.
- *Decisão em aberto (ver §11):* pedido com item em `FORA DE FABRICAÇÃO`/`DESISTÊNCIA` deve contar como COMPLETO para fins de arquivamento? Premissa atual: sim, esses status "resolvem" o item.

### 5.4 Máquina de estados — Nota Fiscal (rastreio)

```
[ EM FABRICAÇÃO ] ─► [ TRÂNSITO ] ─► [ RECEBIDA ] ─► [ ARMAZENADA ]
                          │                                 ▲
                          └──────────► [ EXTRAVIADO ]        │
                                                    (clientes sem acesso:
                                                     RECEBIDA → ARMAZENADA presumida)
```

- Estados confirmados nas planilhas: `S/NFE`, `TRÂNSITO`, `RECEBIDA`, `ARMAZENADA`, `EXTRAVIADO`. O estado inicial **EM FABRICAÇÃO** foi adicionado na modelagem do fluxo (a NFe existe mas a mercadoria ainda não saiu) — *a lista de estados ainda pode ser ajustada (há estados adicionais a mapear).*
- Cada transição registra **observação** e **data**.
- Para clientes **com acesso ao sistema**, "ARMAZENADA" exige confirmação de saldo de estoque. Para clientes **sem acesso**, avança de RECEBIDA para ARMAZENADA de forma presumida.
- **Reemissão:** uma NFe cancelada e reemitida mantém vínculo estruturado `original -> substituta` (substitui a notação textual `->` da planilha).
- **Bloqueio SEFAZ:** NFe não autorizada (ex.: CCe rejeitada) precisa de estado/fluxo próprio — mapear (ver §11).

### 5.5 Máquina de estados — Chamado de divergência

```
[ ABERTO ] ─► [ EM TRATATIVA ] ─► [ AGUARDANDO (fábrica / transportadora / cliente) ] ─► [ RESOLVIDO ]
                     │
                     └─► (alerta CRÍTICO se ficar sem novo evento por X dias — padrão ~30)
```

---

## 6. Fluxos operacionais

### 6.1 Fluxo principal — do pedido ao fechamento

Este é o fluxo de maior frequência no dia a dia.

1. **Criar o pedido.** O operador importa o pedido via planilha Excel ou PDF (extração automática dos itens), ou cadastra manualmente como fallback. O pedido nasce no status **SEM NFE**.
2. **Aguardar a NFe.** O pedido fica aguardando o faturamento da fábrica. **Ponto crítico:** se ficar muitos dias sem NFe, o sistema exibe alerta — significa que a fábrica ainda não deu devolutiva.
3. **Importar o XML da NFe.** Quando a fábrica emite, o operador importa o XML no sistema.
4. **Conferir NFe × pedido.** O sistema compara a NFe com os itens pendentes do pedido (por CNPJ + referência + quantidade + valor unitário) e sinaliza divergências. A tela de conferência é **muito editável, visual e detalhada**.
   - **Faturamento integral:** nada fica pendente; basta acompanhar o rastreio da NFe até a entrega para depois fechar o processo.
   - **Faturamento parcial:** o pedido permanece **PARCIAL** e deixa explícito o que ainda está pendente.
5. **Confirmar a baixa.** O operador revisa e confirma; o sistema atualiza a quantidade pendente de cada item e registra a baixa com usuário, data e hora.
6. **Acompanhar o rastreio.** A NFe avança pelos status logísticos (integração com a transportadora; ver §7) até **ARMAZENADA**.
7. **Fechar o pedido.** Quando todos os itens estão resolvidos, o pedido fica **COMPLETO** e pode ser **arquivado**.

### 6.2 Fluxo de divergência (chamado)

1. O cliente reporta um problema na entrega (nota errada, item faltando, item quebrado etc.).
2. O operador **abre um chamado a partir da NFe** correspondente — o chamado já nasce alimentado com todo o contexto do processo (NFe, pedido, cliente, itens).
3. O operador seleciona o(s) **motivo(s)**: número de itens errado, item faltando, item quebrado, acionar garantia, NFe com valor errado, extravio etc.
4. A tratativa avança com **eventos registrados** no histórico do chamado (acionamento de garantia, contato com fábrica/transportadora, resolução).
5. Se o chamado ficar **sem atualização** por um período (padrão ~30 dias), o sistema o marca como **crítico** e o reabre na fila do dia até haver novo evento.
6. Existe uma **página dedicada de divergências** que centraliza todos os chamados pendentes, com histórico completo.

### 6.3 Fluxo de conciliação com sistema da fábrica (Autoflex — V2)

1. Periodicamente, o operador compara as pendências da plataforma com as pendências registradas no sistema interno da Autoflex.
2. Cada item recebe uma **flag estruturada** de alinhamento (pendente nos dois | divergente | baixa solicitada pela fábrica | triplicidade etc.) — substituindo as observações em texto livre da planilha atual.
3. A resolução de cada divergência é registrada com responsável e data.

---

## 7. Integrações

| Integração | Finalidade | Abordagem | Fase |
|---|---|---|---|
| **Transportadoras (API)** | Consulta automática do código de rastreio e atualização de status logístico | API quando disponível | V2 |
| **Transportadoras (navegador)** | Rastreio quando a transportadora não tem API | Automação via navegador (Chrome/Playwright — avaliar melhor opção) | V2 |
| **Sistema interno Autoflex** | Conciliação de pendências planilha × fábrica | Scraping ou API, conforme disponibilidade | V2 |
| **Portais de clientes** | Confirmação automática de "ARMAZENADA" via saldo de estoque | Portal web por cliente (varia) | V3 |
| **SEFAZ** | Consulta de situação/autorização da NFe | API SEFAZ | V3 |

> A escolha entre Chrome e Playwright para o fallback de rastreio fica como decisão técnica de implementação. O requisito de produto é: **rastreio sempre atualizado, com API como caminho preferencial e navegação automatizada como fallback.**

---

## 8. Inventário de telas / módulos

Mapeado a partir do wireframe navegável v2.0.

| Módulo | Tela | O que entrega |
|---|---|---|
| **Visão geral** | Dashboard | KPIs (pedidos em andamento, saldo a faturar, divergências abertas, NFes em trânsito), gráfico pedidos × NFe, fila do dia |
| **Pedidos** | Lista de pedidos | Tela-casa do operador. Filtro segmentado Em andamento / Concluídos / Arquivados / Todos. Coluna de NFes e situação por pedido |
| | Importar pedido | Upload Excel/PDF → cabeçalho extraído → itens detectados → confirmação |
| | **Detalhe do pedido** | Coração do sistema: ciclo de vida (stepper), abas Itens / Notas fiscais / Histórico & auditoria. Por item, quanto foi faturado e por quais NFes |
| **Conferência NFe** | Conferência | Importar XML → comparação item a item (pendente × NFe) → divergências destacadas → confirmar baixa. Suporte a NFe que cobre vários pedidos |
| **Rastreio NFe** | Rastreio | Timeline por NFe, origem do status (API / navegador / manual), lista de NFes em rastreio, alerta de NFe parada |
| **Divergências** | Lista de chamados | KPIs de chamados, filtro Abertos / Resolvidos / Todos, coluna de última atualização com alerta de inatividade |
| | **Detalhe do chamado** | Contexto da NFe, motivos, itens afetados, histórico (thread), configuração de alerta de inatividade |
| **Pedidos × NFe** | Painel financeiro | Gráfico e consolidado mensal por fábrica/cliente, com gap de faturamento; exportação XLSX |
| **Alertas** | Central de alertas | Alertas configuráveis: pedido sem NFe, NFe parada, divergência sem atualização, extravio, NFes aguardando conferência |
| **Clientes & Fábricas** | Cadastros | Fábricas representadas, clientes (multi-fábrica), flags de acesso e confirmação de estoque |

---

## 9. Requisitos funcionais

Numeração consolidada (base: diagnóstico v2.0, ampliada com o fluxo operacional). Prioridade: **P0** = MVP · **P1** = V2 · **P2/P3** = futuro.

### Núcleo — cadastros e pedidos

| ID | Requisito | Prioridade |
|---|---|---|
| RF01 | **Multi-fábrica** — dados separados por fábrica, com troca de contexto de fábrica | P0 |
| RF02 | **Cadastro de clientes** — CNPJ, fantasia, fábricas atendidas, flag de acesso ao sistema, tipo de confirmação de estoque | P0 |
| RF03 | **Upload de pedido Excel** — extração automática de itens | P0 |
| RF04 | **Cadastro manual de pedido** — fallback para PDFs e casos especiais | P0 |
| RF05 | **Pedido sem número** — suporte a `S/N` com flag visual | P0 |
| RF06 | **Listagem de itens pendentes** — filtros por fábrica, cliente, mês, referência e status | P0 |

### Pedido como entidade central

| ID | Requisito | Prioridade |
|---|---|---|
| RF07 | **Ciclo de vida do pedido** — SEM NFE → PARCIAL → COMPLETO → ARQUIVADO, com transições automáticas conforme baixa dos itens | P0 |
| RF08 | **Detalhe do pedido com NFes-filhas** — visão de todas as NFes vinculadas a um pedido (1:N) | P0 |
| RF09 | **Item atendido por várias NFes** — baixa parcial progressiva, com registro de quanto cada NFe faturou de cada item | P0 |
| RF10 | **Arquivamento reversível** — arquivar oculta da tela operacional; pedido reexibível para consulta a qualquer momento | P0 |
| RF11 | **Status de item** — `PENDENTE`, `OK`, `FORA DE FABRICAÇÃO`, `DESISTÊNCIA`, com observação | P0 |

### Conferência de NFe

| ID | Requisito | Prioridade |
|---|---|---|
| RF12 | **Upload e parsing de NFe XML** — emitente, destinatário, chave de acesso, itens, quantidades, valores | P0 |
| RF13 | **Conferência automática** — comparação por CNPJ + REF + quantidade + valor unitário, com divergências sinalizadas | P0 |
| RF14 | **NFe cobre múltiplos pedidos** — relacionar uma NFe a vários pedidos do mesmo cliente | P0 |
| RF15 | **Confirmação manual da baixa** — operador revisa e confirma; sistema atualiza status e quantidade pendente | P0 |
| RF16 | **Tela de conferência editável e detalhada** — muito visual, com edição dos vínculos antes da baixa | P0 |
| RF17 | **Relatório de cruzamento por NFe** — geração automática (substitui a aba CRUZAMENTO NF manual) | P0 |
| RF18 | **NFe cancelada e reemitida** — vínculo estruturado original → substituta com histórico | P1 |
| RF19 | **Upload de NFe PDF/DANFE** — leitura via OCR como alternativa ao XML | P1 |

### Rastreio logístico

| ID | Requisito | Prioridade |
|---|---|---|
| RF20 | **Ciclo de status da NFe** — EM FABRICAÇÃO → TRÂNSITO → RECEBIDA → ARMAZENADA / EXTRAVIADO, com observação por transição | P0 |
| RF21 | **Integração de rastreio via API** — consulta automática do código de rastreio da transportadora | P1 |
| RF22 | **Fallback de rastreio via navegador** — automação (Chrome/Playwright) quando não há API | P1 |
| RF23 | **Confirmação de "ARMAZENADA"** — automática (cliente com acesso) ou presumida (sem acesso) | P1 |
| RF24 | **Fluxo de extravio** — registro de NFe extraviada e acompanhamento do ressarcimento | P1 |

### Divergências / chamados

| ID | Requisito | Prioridade |
|---|---|---|
| RF25 | **Abrir chamado a partir da NFe** — chamado nasce alimentado com todo o contexto (NFe, pedido, cliente, itens) | P0 |
| RF26 | **Motivos de divergência** — itens errados, item faltando, item quebrado, acionar garantia, NFe com valor errado, extravio | P0 |
| RF27 | **Página dedicada de divergências** — centraliza todos os chamados pendentes, com histórico completo | P0 |
| RF28 | **Histórico do chamado** — thread de eventos com usuário e data | P0 |
| RF29 | **Alerta de inatividade** — chamado sem atualização por X dias (padrão ~30) vira crítico e reaparece na fila | P0 |
| RF30 | **Itens afetados no chamado** — vínculo estruturado entre divergência e itens da NFe | P0 |

### Análise, alertas e auditoria

| ID | Requisito | Prioridade |
|---|---|---|
| RF31 | **Painel PEDIDOS × NFE** — pedidos, NFes e gap por mês/ano, por fábrica e cliente | P0 |
| RF32 | **Log de auditoria** — campo, valor anterior, valor novo, usuário, data e hora, imutável | P0 |
| RF33 | **Exportação para Excel** — qualquer listagem em XLSX | P0 |
| RF34 | **Alerta de pedido sem NFe** — notificação configurável quando passa do SLA sem faturamento | P0 |
| RF35 | **Alerta de NFe parada** — quando não avança de status após X dias | P1 |
| RF36 | **Central de alertas configurável** — limiares por tipo de alerta | P1 |

### Conciliação e migração

| ID | Requisito | Prioridade |
|---|---|---|
| RF37 | **Conciliação com sistema da Autoflex** — comparação de pendências plataforma × fábrica | P1 |
| RF38 | **Flag de divergência de conciliação** — campo estruturado (pendente nos dois / divergente / baixa solicitada / triplicidade) | P1 |
| RF39 | **Migração de dados históricos** — importação das planilhas Bowden e Autoflex | P1 |

### Futuro

| ID | Requisito | Prioridade |
|---|---|---|
| RF40 | **NFe bloqueada por SEFAZ** — registro e acompanhamento de NFes não autorizadas (CCe rejeitada) | P2 |
| RF41 | **Gestão de devoluções** — NF de devolução com reabertura de itens pendentes | P2 |
| RF42 | **Cancelamento de pedido** — fluxo com registro de motivo | P2 |
| RF43 | **Integração com portais de clientes** — confirmação automática de estoque | P3 |
| RF44 | **Integração com SEFAZ** — consulta automática de situação de NFe | P3 |
| RF45 | **App mobile** — atualização de status em campo | P3 |
| RF46 | **Relatório de divergências exportável** | P2 |

---

## 10. Regras de negócio

Consolidadas dos diagnósticos v1.0/v2.0 e da modelagem do fluxo.

| ID | Regra |
|---|---|
| RN01 | Pedidos chegam por e-mail em PDF ou Excel. |
| RN02 | Pedidos sem número interno são registrados como `S/N`. |
| RN03 | Cada fábrica tem seus dados separados; o sistema é multi-fábrica desde o MVP. |
| RN04 | A conferência da NFe compara CNPJ destinatário + REF + quantidade + valor unitário. |
| RN05 | Item atendido integralmente → `OK`. |
| RN06 | Item atendido parcialmente → permanece `PENDENTE`, quantidade pendente ajustada. |
| RN07 | Item descontinuado pela fábrica → `FORA DE FABRICAÇÃO`. |
| RN08 | Item cancelado pelo cliente → `DESISTÊNCIA`. |
| RN09 | Um pedido pode ter várias NFes (faturamento parcial pela fábrica). |
| RN10 | Uma NFe pode cobrir itens de vários pedidos do mesmo cliente. |
| RN11 | Um item pode ser atendido por várias NFes (baixa parcial progressiva). |
| RN12 | Uma NFe cancelada e reemitida mantém vínculo estruturado original → substituta. |
| RN13 | Ciclo de status da NFe: EM FABRICAÇÃO → TRÂNSITO → RECEBIDA → ARMAZENADA / EXTRAVIADO. |
| RN14 | Cliente com acesso ao sistema: "ARMAZENADA" exige confirmação de saldo de estoque. |
| RN15 | Cliente sem acesso: status avança de RECEBIDA para ARMAZENADA presumidamente. |
| RN16 | O pedido encerra seu ciclo quando todos os itens pendentes foram resolvidos (OK / Fora de fabricação / Desistência) → COMPLETO. |
| RN17 | Pedido COMPLETO pode ser arquivado; arquivamento é filtro de visualização, não exclusão. |
| RN18 | Toda divergência (chamado) nasce a partir de uma NFe. |
| RN19 | Chamado sem atualização por X dias (padrão ~30) torna-se crítico. |
| RN20 | A chave de acesso da NFe é sempre registrada. |
| RN21 | O confronto PEDIDOS × NFE é por mês e ano, com total anual. |
| RN22 | A Autoflex tem sistema interno conciliado com a plataforma; a Bowden não. |
| RN23 | Clientes que atendem a mais de uma fábrica são tratados de forma independente por fábrica. |
| RN24 | O rastreio usa API quando disponível e navegação automatizada como fallback. |

---

## 11. Decisões e perguntas em aberto

### 11.1 Decisões de produto pendentes (impactam modelagem/telas)

1. **Vínculo da divergência** — o chamado prende na NFe, no item, ou em ambos? *Premissa atual: na NFe + itens afetados.*
2. **Origem do chamado** — só a partir de uma NFe específica, ou também a partir do pedido quando a reclamação cruza várias notas? *Premissa atual: a partir da NFe.*
3. **"Completo" vs. itens não-OK** — pedido com item em `FORA DE FABRICAÇÃO`/`DESISTÊNCIA` conta como COMPLETO para arquivamento? *Premissa atual: sim.*
4. **Estados adicionais da NFe** — há estados além dos mapeados (a confirmar com o cliente); `EM FABRICAÇÃO` foi adicionado na modelagem e pode ser revisto.
5. **Prazo padrão de inatividade do chamado** — ~30 dias é o padrão; deve ser configurável por motivo? (ex.: garantia tem prazo diferente de item faltando).
6. **Granularidade do SLA de faturamento** — o alerta de "pedido sem NFe" usa um SLA único ou por fábrica/cliente?

### 11.2 Perguntas de negócio (carregadas dos diagnósticos)

- **FORA DE FABRICAÇÃO** — a fábrica sugere substituto? Há comunicação formal ao cliente?
- **DESISTÊNCIA** — o pedido é cancelado junto à fábrica? Gera documento?
- **SLA pedido → NFe** — existe prazo aceitável definido?
- **NF de devolução** — existe esse fluxo? O item volta a `PENDENTE`?
- **Valor no painel PEDIDOS × NFE** — inclui ou exclui frete e impostos?
- **Autoflex** — frequência da conciliação? Quem é "Narlan" (contato na fábrica)? A Autoflex tem API ou só portal?
- **NFe bloqueada por SEFAZ (CCe)** — qual o fluxo atual de resolução e reemissão?
- **Ressarcimento de extravio** — envolve fábrica, transportadora, cliente, ou os três?
- **Outras fábricas** — existem além de Bowden e Autoflex?
- **Operadores** — quantos executam o processo hoje? Há divisão por fábrica ou cliente?

### 11.3 Perguntas de projeto

- Os dados históricos de ambas as planilhas precisam ser migrados? Qual o período mínimo?
- Preferência de tecnologia (web / desktop / SaaS)?
- Restrição de orçamento que defina o escopo do MVP?
- Time de TI interno ou manutenção por fornecedor externo?

---

## 12. Requisitos não funcionais

**Segurança e acesso**
- Autenticação com usuário e senha; suporte a 2FA.
- Controle de perfis com permissões por módulo e por fábrica.
- Credenciais de portais externos (clientes, Autoflex, transportadoras) armazenadas com criptografia.

**Auditoria e rastreabilidade**
- Log imutável de toda alteração: campo, valor anterior, valor novo, usuário, timestamp.
- Consulta de histórico por período, por usuário ou por registro.
- Cobertura de 100% das alterações em pedidos e NFes.

**LGPD**
- Dados de clientes (CNPJ, nome) são empresariais, mas com política de retenção definida.
- Acesso restrito por perfil; log de acesso a dados sensíveis.

**Performance**
- Parsing de NFe XML: < 5 s.
- Conferência automática com até 50 itens: < 10 s.
- Listagens com filtros: < 3 s.
- Suporte a base de pelo menos 50.000 itens históricos sem degradação.

**Disponibilidade**
- Mínimo de 99% em horário comercial.

**Backup e exportação**
- Backup automático diário.
- Exportação completa da base em formato aberto (CSV/XLSX/JSON) a qualquer momento.

**Usabilidade**
- Interface adaptada para usuários não técnicos.
- Conferência de NFe completa em no máximo 3 etapas após o upload.
- Telas de conferência e auditoria de NFe muito visuais, detalhadas e editáveis.

---

## 13. Estratégia de release

### 13.1 MVP

Objetivo: substituir as planilhas no fluxo principal, com o pedido como entidade central e auditoria desde o dia um.

- Multi-fábrica (Bowden + Autoflex) e cadastro de clientes
- Upload de pedido Excel + cadastro manual + suporte a `S/N`
- Pedido com ciclo de vida completo (SEM NFE → PARCIAL → COMPLETO → ARQUIVADO)
- Detalhe do pedido com NFes-filhas e itens com baixa parcial (item ↔ várias NFes)
- Todos os status de item (PENDENTE, OK, FORA DE FABRICAÇÃO, DESISTÊNCIA)
- Upload de NFe XML + parsing + conferência automática com divergências
- NFe cobrindo vários pedidos
- Confirmação manual de baixa + relatório de cruzamento automático
- Ciclo de status da NFe (rastreio manual)
- Divergências: abertura a partir da NFe, motivos, página dedicada, histórico, alerta de inatividade
- Painel PEDIDOS × NFE automático
- Alerta de pedido sem NFe
- Log de auditoria + exportação XLSX

### 13.2 V2

- Integração de rastreio (API + fallback navegador)
- Confirmação de "ARMAZENADA" e fluxo de extravio
- Conciliação com sistema da Autoflex + flag estruturada
- NFe cancelada e reemitida com vínculo
- Upload de NFe PDF/DANFE (OCR)
- Alertas de NFe parada e central configurável
- Migração das planilhas históricas

### 13.3 V3+

- Integração com portais de clientes (confirmação de estoque)
- Integração com SEFAZ
- NFe bloqueada por SEFAZ (fluxo dedicado)
- Devoluções e cancelamentos
- App mobile
- Indicadores avançados: SLA de faturamento, índice de divergências por fábrica, aging de pendências

---

## 14. Riscos

| Risco | Impacto | Mitigação |
|---|---|---|
| Variação no layout dos arquivos de pedido (Excel/PDF) entre clientes | Extração automática falha | Cadastro manual como fallback desde o MVP; mapeamento por cliente na V2 |
| Transportadoras sem API | Rastreio incompleto | Fallback por navegação automatizada (Playwright/Chrome) |
| Qualidade dos dados históricos das planilhas | Migração suja | Validação e saneamento na migração; migração não bloqueia o MVP (V2) |
| Casos complexos não totalmente mapeados (SEFAZ, devolução) | Retrabalho de modelagem | Tratados como P2; decisões registradas em §11 antes de implementar |
| Dependência de conhecimento implícito dos operadores | Regras incompletas | Validação das perguntas em aberto antes de fechar o backlog |

---

## 15. Glossário

| Termo | Significado |
|---|---|
| **Representação comercial** | Empresa que intermedeia vendas entre fábricas e clientes, sem estocar mercadoria |
| **Pedido** | Solicitação de compra emitida por um cliente |
| **NFe** | Nota fiscal eletrônica emitida pela fábrica |
| **DANFE** | Representação em PDF da NFe |
| **Chave de acesso** | Identificador único da NFe (44 dígitos, padrão SEFAZ) |
| **Faturamento parcial** | Quando a fábrica fatura só parte de um pedido em uma NFe |
| **Divergência / Chamado** | Registro de problema reportado pelo cliente sobre uma NFe |
| **Conciliação** | Comparação das pendências da plataforma com o sistema interno da fábrica (Autoflex) |
| **S/N** | Pedido sem número interno do cliente |
| **Gap de faturamento** | Diferença entre o valor pedido e o valor já faturado |
| **CCe** | Carta de Correção Eletrônica de uma NFe |
| **SLA** | Prazo aceitável entre dois eventos (ex.: pedido recebido → NFe emitida) |
