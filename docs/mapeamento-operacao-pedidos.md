# Mapeamento — módulo de Pedidos pronto para a operação do Zé Luiz

**Data:** 07/10/2026 · **Autor:** Arthur (com Claude) · **Status:** proposta para implementação imediata
**Fontes:** PRD master (§5, §6, §8–10), planilhas AUTOFLEX / BOWDEN / SEINECA / RUDOLPH COMPACTADA, NFE EMITIDAS POR MÊS, PEDIDOS RECEBIDOS 2026, PDFs reais (pedidos Bling da Bowden, DANFEs Bowden e Autoflex), gravações da reunião de 07/10 com o Zé, e o código atual em `src/app/(app)/*`.

---

## 1. O que a reunião mudou no entendimento

| O que o PRD assumia | O que o Zé faz de verdade | Consequência no produto |
|---|---|---|
| Pedido chega por e-mail em PDF/Excel (RN01) | Chega **também como print de WhatsApp** de vendedor (Patrick), sem CNPJ nem itens — só nome do cliente e valor total | Precisa de **registro rápido sem itens** ("só pra ver se vai bater") |
| Operador importa e confere item a item | O que ele mais quer ver é **"pedidos recebidos sem nota emitida, por fábrica"** | A tela-casa é essa lista, agrupada por fábrica, com valor total |
| Número do pedido = número da fábrica | Há **dois números**: o da fábrica/Bling (4286) e a **ordem de compra do cliente** (0.2385; "PEDIDO DO CLIENTE 4504364932" na DANFE Autoflex) | Pedido ganha `numeroCliente`; a NFe traz `xPed`, que **liga a nota ao pedido sozinha** |
| Rastreio manual | Quer o **código/status da transportadora conferido automaticamente** | Transportadora vira entidade; status vem por integração (SSW cobre 2 das 5 vistas) |
| Pedido × NFe é o painel financeiro | Faturamento tem **regra de comissão por fábrica** (Autoflex: total da nota, inclui Girão; Bowden: só produtos, exclui Girão; Seineca: período dia 20→19) e **Girão é cliente e representante** (matriz + filial) | Fica para fase 2, mas o modelo já precisa marcar `cliente.ehCasaPropria` e `fabrica.regraComissao` |
| Status da NFe: TRÂNSITO/RECEBIDA/ARMAZENADA/EXTRAVIADO | Planilha usa também **AGENDADO** e **S/NFE**, e observações padronizadas ("ARMAZENADA - 03/10/26", "SEM PREVISÃO", "AGUARDANDO EMISSÃO DE NF", "ENTREGUE NO CLIENTE ERRADO") | Adicionar `AGENDADO`; `previsaoEntrega`; observação com sugestões prontas |
| Itens só com status | Observações recorrentes: "DIVERGÊNCIA NARLAN x ESCRITÓRIO (Cliente: 2 / Escritório: 0)", "OK - ERRO DE BAIXA NO ESCRITÓRIO", "PEND AUTOFLEX TAMBÉM"; **TIPO PEDIDO** = BONIFICAÇÃO / CANCELADA | Observação com atalhos; `tipo` no pedido (NORMAL/BONIFICAÇÃO); cancelamento como estado |
| Um operador | Zé é o operador; Rômulo vê no celular; **vendedor por cliente** (ESCRITÓRIO/FABIANO/THALES/ALCYR, com vigência) existe para pagar comissão | `cliente.vendedor` com vigência — fase 2 |

Zé vai **manter a planilha de notas e a de pedidos por enquanto** e centralizar o acompanhamento no sistema. Então o sistema tem de ser melhor que a planilha exatamente nisso: ver o que falta faturar e onde está cada nota.

---

## 2. Princípio para amanhã

**Nenhum pedido pode ficar fora do sistema por falta de dado.** Hoje o fluxo exige fábrica + cliente + itens com referência, quantidade e valor. O print do Patrick não tem nada disso. Amanhã o Zé precisa conseguir:

1. Registrar em 20 segundos: fábrica, cliente, valor total, data, (número se tiver). Itens depois ou nunca.
2. Ver, por fábrica, o que está sem nota e quanto é.
3. Subir o XML da nota e o sistema achar o pedido sozinho (por `xPed` ou por CNPJ + valor).
4. Saber onde está a nota sem abrir site de transportadora.

---

## 3. Telas que mudam

### 3.1 `/pedidos` — lista (tela-casa)

**Hoje:** tabela plana, abas Em andamento / Concluídos / Arquivados / Todos; colunas Número, Fábrica, Cliente, Itens, Estado.

**Muda para:**
- **Agrupar por fábrica** com cabeçalho de grupo: "Autoflex · 12 pedidos sem nota · R$ 184.320,00" (é a visão que ele pediu com essas palavras).
- Colunas: Número da fábrica · **Nº do cliente** · Cliente · Data do pedido · **Valor total** · **NFes** (chips "3264 / 3449", como na planilha) · **Dias sem nota** (destaque ≥ SLA) · Estado.
- Filtro rápido no topo (segmented): **Sem nota · Parcial · Completo** (substitui "Em andamento" genérico; "Arquivados/Todos" vão para um menu "Mais").
- Filtros laterais colapsáveis: fábrica, cliente, mês, vendedor (quando existir).
- Linha com **ícone de origem** (Excel · PDF · Manual · **Rápido/WhatsApp**) e aviso "sem itens" para pedidos rápidos.
- Botão primário vira **"Registrar pedido"** com menu: *Rápido (do WhatsApp)* · *Importar PDF* · *Importar Excel* · *Manual completo*. Hoje são 3 botões secundários + 1 primário que competem.
- Busca por número, nº do cliente, cliente ou referência (campo único).
- Mobile (Rômulo): só cabeçalhos de fábrica com totais; expande para a lista.

### 3.2 `/pedidos/[id]` — detalhe

**Hoje:** stepper SEM_NFE→PARCIAL→COMPLETO, abas Itens / Notas fiscais / Histórico, ações Arquivar/Reabrir.

**Muda para:**
- Cabeçalho com: valor total do pedido, **valor faturado**, **saldo a faturar**, dias desde o pedido, nº do cliente, origem (link para o PDF/arquivo quando existir).
- Aba **Itens**: coluna "NFes" com chips clicáveis; observação com **sugestões prontas** (Divergência cliente × escritório · Erro de baixa no escritório · Pendente na fábrica também · Fora de fabricação · Desistência); editar status abre modal pequeno, não form inline (hoje `item-status-form`).
- Pedido **rápido sem itens**: aba Itens mostra estado vazio "Este pedido foi registrado só pelo valor. Quando chegar o PDF ou a nota, os itens entram aqui." com botões **Adicionar itens** (abre grade do importar-pdf) e **Anexar PDF do pedido** (roda a extração e preenche os itens do mesmo pedido, não cria outro).
- Aba **Notas fiscais**: cada nota com status de rastreio, transportadora, **previsão de entrega**, última ocorrência e botão "Ver rastreio". Botão **"Conferir nova NFe para este pedido"** (vai para `/conferencia` com o pedido pré-selecionado).
- Aba **Histórico**: já existe; incluir eventos de rastreio automático ("Transuni: Em trânsito para Belém, 06/10 14:32 · automático").
- Ações: Arquivar/Reabrir (existente) + **Cancelar pedido** (motivo obrigatório; estado novo) + **Marcar como bonificação**.

### 3.3 `/pedidos/importar-pdf`

**Hoje:** upload → grade editável → confirma. Lê fábrica/cliente por CNPJ, número do pedido, itens, confere totais.

**Muda para:**
- Ler e exibir também: **Nº do pedido do cliente / ordem de compra** (Bling imprime), **data**, **transportador e frete (CIF/FOB)** (Bling imprime "Transportador: NEWLOG, FOB"), **vendedor** (Bling imprime), **valor total declarado**.
- Se o CNPJ do cliente não existir: botão **"Cadastrar cliente com estes dados"** no próprio aviso (hoje só avisa; obriga a sair da tela).
- Se já existir **pedido rápido** da mesma fábrica + cliente com valor igual (±1%) e sem itens: banner "Parece ser o pedido que você registrou em 05/10 por R$ 18.611,00. **Completar aquele pedido** · Criar outro".
- Depois de confirmar: ir para o **detalhe do pedido criado**, não para a lista (hoje `router.push("/pedidos")`), com toast "Pedido 4286 criado · 40 itens · R$ 43.672,44".
- Permitir **vários PDFs de uma vez** (Zé recebe vários por dia): fila à esquerda, revisão à direita, "Confirmar e próximo".
- Remover o `[debug: …]` do erro de extração antes de o Zé usar.

### 3.4 `/pedidos/novo` → vira "Manual completo"; nasce `/pedidos/rapido`

Ver §4.1. O form atual continua para quem quer digitar itens.

### 3.5 `/conferencia` (NFe × pedido)

**Hoje:** upload XML, cruzamento por CNPJ + referência + qtd + valor, confirmar baixa.

**Muda para:**
- Ler do XML: `<transp><transporta>` (CNPJ, nome), `<vol>` (volumes, peso), `<det><prod><xPed>` e `<nItemPed>`.
- **Sugerir o pedido automaticamente**: 1º por `xPed` = número ou nº do cliente; 2º por CNPJ destinatário + valor total igual ao de um pedido rápido; 3º por CNPJ e itens. Mostrar "Encontrei o pedido 4286 (ordem 0.2385) — é esse?" com confirmação de um clique.
- Para **pedido rápido sem itens**: a nota **cria os itens** a partir da NFe e marca tudo OK; mostra diferença de valor (pedido R$ 18.611,00 × nota R$ 18.590,30) e pede confirmação.
- Ao confirmar a baixa: criar/atualizar a **Transportadora** e disparar a primeira consulta de rastreio na hora; mostrar resultado no toast ("Nota 4143 vinculada · Solidez · consultando rastreio…").
- **Upload múltiplo de XML** (ZIP ou vários arquivos) — a fábrica manda em lote.
- DANFE em PDF (RF19): fase 2; por ora aviso claro "Preciso do XML; o PDF da DANFE só serve para conferência visual".

### 3.6 `/rastreio`

**Hoje:** tabela Número / Chave / Status, paginada.

**Muda para:**
- Colunas: NFe · Pedido · Cliente · **Transportadora** · Status · **Previsão** · **Última ocorrência** (texto + data) · **Atualizado há** · origem (automático / manual).
- Filtro segmentado: **Em trânsito · Agendadas · Recebidas · Paradas (>X dias sem ocorrência) · Extraviadas · Todas**.
- Linha com ícone de problema quando: transportadora sem integração, consulta falhou 3×, sem ocorrência há > 5 dias.
- Botão "Atualizar agora" por linha e geral (dispara a consulta imediatamente).
- Detalhe `/rastreio/[id]`: **timeline** das ocorrências (já há `EventoRastreio`; passa a receber eventos automáticos), link externo "Abrir no site da transportadora" (com chave já preenchida quando a URL permite), botões *Marcar recebida* · *Marcar armazenada* · *Registrar extravio* · *Abrir chamado*.
- Observação de transição com sugestões prontas: "Sem previsão", "Aguardando emissão de NF", "Entregue no cliente errado", "Agendado para dd/mm".

### 3.7 Home (`/`)

- KPIs passam a ter **valor em R$** além de contagem: "Sem nota: 23 pedidos · R$ 412.000" (planilha PEDIDOS RECEBIDOS tem ticket médio e ranking; é isso que ele olha).
- Blocos por fábrica (4 cards): recebido no mês · faturado no mês (notas) · a faturar.
- "Fila do dia": pedidos sem nota acima do SLA, notas paradas, transportadoras sem integração, chamados críticos.
- Mobile: só os 4 cards de fábrica e a fila.

### 3.8 `/alertas`

- Novo tipo: **NFe parada** (RF35), **Transportadora sem rastreio** (nova), **Pedido rápido há > N dias sem itens**.
- SLA por fábrica (decisão 11.1-6 do PRD): campo em `Fabrica` com default global.

### 3.9 Cadastros

- **Cliente**: `numeroClienteNaFabrica`? não — o número vem no pedido. Adicionar: `ehCasaPropria` (Girão), `matrizId` (filial → matriz), `vendedor` com vigência (fase 2), `uf/cidade` (rastreio e Rudolph N/NE).
- **Fábrica**: `slaDiasSemNota`, `regraComissao` (TOTAL_NOTA / SOMENTE_PRODUTOS), `comissaoIncluiCasaPropria`, `periodoComissao` (MES_CIVIL / DIA_20_A_19) — gravar já, usar na fase 2.
- **Transportadoras** (nova, §4.3).

---

## 4. Telas novas

### 4.1 `/pedidos/rapido` — "Registrar pedido do WhatsApp"

Um formulário de uma coluna, 5 campos, cabe no celular:

1. Fábrica (select; lembra a última)
2. Cliente (busca por nome/CNPJ; se não achar → "Cadastrar só com nome e CNPJ" inline)
3. Valor total (R$)
4. Data do pedido (default hoje)
5. Número do pedido (opcional) · **Cole o print** (opcional, imagem; guarda como `ArquivoImportado`; fase 2: ler com IA)

Observação livre (ex.: "print do Patrick no grupo Autoflex").
Botão **"Registrar e ficar nesta tela"** (registra outro em seguida) e **"Registrar e abrir"**.
Cria `Pedido{origem: RAPIDO, valorTotalDeclarado, semItens: true, estado: SEM_NFE}`.
Confirmação: toast "Registrado: Autoflex · Ara Auto · R$ 18.611,00 · aguardando nota" com **Desfazer** (10 s, mesmo padrão do CRM).

### 4.2 `/pedidos/sem-nota` (ou aba fixa dentro de `/pedidos`)

A lista do Zé "fisicamente": por fábrica, pedidos sem nota ordenados por data, com total por fábrica e geral, e botão "Exportar" (ele vai mandar isso para a fábrica cobrar). Pode ser o filtro "Sem nota" da lista agrupada — **não precisa ser rota separada** se §3.1 for feito; manter como atalho na navegação lateral ("Sem nota (23)").

### 4.3 `/cadastros/transportadoras`

Lista: Nome · CNPJ · **Método de rastreio** (SSW · ESL · Site próprio · FedEx · Manual · **Não mapeada**) · notas em trânsito · última consulta OK · falhas.
Detalhe/modal: método, parâmetros (ex.: CNPJ remetente para SSW por remetente; URL pública), "Testar com a chave de uma nota", contato (telefone/WhatsApp — Newlog só tem isso).
Badge vermelho na navegação quando houver transportadora **Não mapeada** com nota em trânsito.

### 4.4 `/painel/faturamento` — fase 2

Reproduz NFE EMITIDAS POR MÊS: por fábrica e mês, bruto · Girão · líquido; estimativa de comissão pela regra da fábrica; período Seineca 20→19; ranking de fábrica; PAGAMENTO VENDEDORES. Depende de `regraComissao`, `ehCasaPropria`, `vendedor`. **Não entra amanhã**, mas os campos sim.

### 4.5 `/pedidos/itens` — ajustes (já existe)

Adicionar "TOP 5 pendentes" (por quantidade e por valor, como na planilha) e coluna NFes; filtro por status e observação.

---

## 5. Rastreio de transportadoras — desenho

### 5.1 De onde vem o dado

| Fonte | Campo | Quando |
|---|---|---|
| XML da NFe (`<transp>`) | `transporta.CNPJ`, `xNome`, `modFrete`, `vol.qVol`, `pesoB` | Na conferência — **principal** |
| PDF do pedido Bling | "Transportador: NEWLOG, FOB" | Na importação do pedido (indica a transportadora **antes** da nota) |
| Formulário de conferência | select de transportadora quando o XML não trouxer (`<transp>` vazio ou frete por conta do destinatário) | Fallback; só aparece se faltar |
| DANFE em PDF | bloco "Transportador/Volumes" | Fase 2 (OCR) |

Regra: **nunca perguntar o que o XML já tem**. O campo só aparece quando falta.

### 5.2 Como consultar (o que achei para as 5 transportadoras vistas nos documentos)

| Transportadora | Onde vi | Rastreio público | Como integrar |
|---|---|---|---|
| **Transuni** (Campinas; CNPJ 09.012.502/0001-07) | DANFEs Autoflex 8480/8481 (Padre Cícero) | Site usa **SSW** (CNPJ remetente + nº NF) | **SSW `POST https://ssw.inf.br/api/trackingdanfe` com `{chave_nfe}`**, sem autenticação, JSON, limite 20 req/s. Primeiro adaptador. |
| **Evidência Logística** (Guarulhos → Norte: Manaus, Belém, Porto Velho) | DANFE Bowden NF-4145 (Impel) | Site anuncia rastreio; a empresa opera em **SSW** | Mesmo adaptador SSW `trackingdanfe` — testar com a chave da 4145 |
| **Solidez Transportes** (Cuiabá; MT/MS/GO/SP/DF/Sul/RO/AC) | DANFE Bowden NF-4143 (Automotor) | `solideztransportes.com.br/rastreamento` (TMS não identificado) | Tentar SSW `trackingdanfe` primeiro (muitas usam); se não, adaptador por navegador (Playwright) — RF22 |
| **Newlog Transportes** (SP, atende NE) | Pedido Bling SAMAUMA (FOB) | **Nenhum** rastreio público; só telefone/WhatsApp (11) 91498-1240 | Método **Manual**: sistema gera o texto "Olá, poderiam informar a situação da NF 4286, chave …?" para o Zé mandar; status fica manual |
| **FedEx** | planilha de rastreio | API oficial (Track API, OAuth) | Fase 2 — exige conta de desenvolvedor |

Base genérica: **SSW** (`trackingdanfe` por chave; ou link `ssw.inf.br/app/tracking/{CNPJ}/{NF}`) e **ESL Cloud** (`{empresa}.eslcloud.com.br/recipient_tracking?document={CNPJ}&number={NF}&number_type=invoice_number`) cobrem a maioria das transportadoras regionais brasileiras. Os dois adaptadores + "navegador" + "manual" fecham o universo.

### 5.3 Modelo

```
Transportadora { id, cnpj @unique, nome, metodo: SSW|ESL|SITE|FEDEX|MANUAL|NAO_MAPEADA,
                 parametros Json?, urlPublica?, contato?, ativa, criadaAutomaticamente,
                 ultimaConsultaOk?, falhasSeguidas }
NotaFiscal    += transportadoraId?, modFrete?, volumes?, pesoBruto?, previsaoEntrega?,
                 ultimaOcorrencia?, ultimaOcorrenciaEm?, rastreioAtualizadoEm?, rastreioFalhas
EventoRastreio+= origem: MANUAL|AUTOMATICO, codigoOcorrencia?, local?
StatusRastreio+= AGENDADO (planilha usa)
Pedido        += numeroCliente?, dataPedido?, valorTotalDeclarado?, semItens, tipo: NORMAL|BONIFICACAO,
                 transportadoraPrevistaId?, freteModalidade?, vendedor?
OrigemPedido  += RAPIDO
EstadoPedido  += CANCELADO
```

### 5.4 Rotina automática

- `vercel.json`: cron **`/api/cron/rastreio`** diário (06:00 BRT) + o já existente de WhatsApp. Consulta todas as notas com status TRÂNSITO/AGENDADO e transportadora com método automático; grava `EventoRastreio` só quando mudou; mapeia ocorrência → status (entregue → RECEBIDA; "agendado" → AGENDADO; extravio/sinistro → marca para revisão, não muda sozinho).
- Botão "Atualizar agora" chama a mesma função para uma nota.
- Nota sem ocorrência nova há > 5 dias → alerta "NFe parada" (RF35).

### 5.5 Transportadora nova (o que você pediu)

1. Na conferência, CNPJ de `<transporta>` desconhecido → cria `Transportadora{metodo: NAO_MAPEADA, criadaAutomaticamente: true}` e **já tenta SSW `trackingdanfe`** com a chave; se responder, promove para `SSW` sozinha (resolve a maioria sem ninguém mexer).
2. Se continuar NAO_MAPEADA ao fim do cron diário: o cron **abre uma issue no GitHub** (`arthur7114/oem-rep`, label `transportadora`) com CNPJ, nome, site se houver, chave de exemplo e nº da nota — idempotente (uma issue por CNPJ, procura antes de criar). Precisa de `GITHUB_TOKEN` com `issues:write` na Vercel.
3. **Rotina do Claude** (scheduled task aqui no Claude Code, a cada 2 dias, 08:00): lê issues abertas com a label, pesquisa o site da transportadora, implementa o adaptador (SSW/ESL/site) em `src/lib/rastreio/adaptadores/`, testa com a chave da issue, abre PR, comenta na issue. Você revisa e faz merge.
4. Na tela, enquanto isso: badge "Sem rastreio automático — em implementação" na nota e na lista de transportadoras; Zé consegue atualizar manualmente.

---

## 6. Fluxos de navegação (resumo)

```
Home ─► card fábrica "Sem nota" ─► /pedidos?fabrica=X&filtro=SEM_NOTA ─► pedido ─► "Conferir NFe" ─► /conferencia (pedido pré-selecionado)
WhatsApp print ─► /pedidos/rapido ─► toast + Desfazer ─► (fica na tela) ou ─► detalhe
PDF da fábrica ─► /pedidos/importar-pdf ─► [achou pedido rápido igual?] ─► completar ─► detalhe
XML da nota ─► /conferencia ─► [achou pedido por xPed/valor?] ─► confirmar ─► baixa + transportadora + 1ª consulta ─► detalhe da nota em /rastreio
/rastreio linha com problema ─► detalhe ─► "Abrir chamado" ─► /divergencias/novo (NFe pré-selecionada)
```

Navegação lateral: Início · **Pedidos** (badge sem nota) · Conferência · Rastreio (badge paradas) · Divergências · Pedidos × NFe · Alertas · Cadastros (Clientes · Fábricas · **Transportadoras**) · Conversas (CRM).

---

## 7. Confirmações, modais e pop-ups

| Ação | Padrão |
|---|---|
| Registrar pedido rápido, confirmar importação, confirmar baixa | **Toast com Desfazer 10 s** (mesmo componente das mensagens). Nada de modal "tem certeza?" para criar. |
| Arquivar, Reabrir | Toast com Desfazer (reversível). |
| Cancelar pedido, Registrar extravio, Descartar rascunho de importação | **Modal de confirmação** com motivo obrigatório; botão destrutivo vermelho; mostra o que vai acontecer. |
| Importação achou pedido parecido / Conferência achou pedido por xPed | **Banner inline** com dois botões (Completar · Criar outro) — não modal; o operador precisa ver os dados ao lado. |
| Valor da nota ≠ valor declarado do pedido rápido | Banner amarelo com os dois valores e a diferença; exige clique em "Confirmar mesmo assim". |
| Transportadora não mapeada ao confirmar baixa | Toast informativo "Transportadora X ainda não tem rastreio automático; vou avisar o Arthur" — **não bloqueia**. |
| Mudar status de item / transição de rastreio manual | **Modal pequeno**: status + observação com sugestões; data da ocorrência (default hoje). |
| Sessão expirada no meio da revisão de PDF | Já durável (`ImportacaoPedido`); mostrar "Seu rascunho está salvo; entre de novo para continuar". |
| Erro técnico | Uma frase em português + "tente de novo"; nunca `[debug: …]`. |

---

## 8. Ordem de implementação

**Amanhã de manhã (antes de o Zé entrar):**
1. `/pedidos/rapido` + `origem RAPIDO`, `valorTotalDeclarado`, `semItens`, `numeroCliente`, `dataPedido` (migration) + botão "Registrar pedido" com menu.
2. Lista `/pedidos` agrupada por fábrica, filtro "Sem nota", coluna Valor e Dias sem nota.
3. Importar PDF: ler nº do cliente/transportador/data; redirecionar para o detalhe; tirar `[debug]`; botão "Cadastrar cliente".
4. Conferência: ler `<transp>` e `xPed`; sugerir pedido; completar pedido rápido a partir da nota.
5. `Transportadora` + adaptador **SSW trackingdanfe** + cron diário + tela de transportadoras; testar com as chaves das DANFEs 4143/4145/8480/8481.
6. Bucket do Supabase Storage (`SUPABASE_SERVICE_ROLE_KEY`) para guardar os PDFs; `CRON_SECRET`; `GITHUB_TOKEN`.

**Esta semana:**
7. `/rastreio` com transportadora/previsão/ocorrência e filtro "Paradas"; `AGENDADO`; observações com sugestões.
8. Home com valores em R$ por fábrica; alertas NFe parada e transportadora sem rastreio.
9. Issue automática de transportadora nova + rotina do Claude a cada 2 dias.
10. Upload múltiplo (PDFs e XMLs).

**Depois (fase 2):**
11. Campos de comissão/Girão/vendedor com vigência e painel de faturamento (NFE EMITIDAS POR MÊS, ESTIMATIVA COMISSÃO, PAGAMENTO VENDEDORES).
12. Adaptadores ESL, Solidez (navegador), FedEx; leitura do print por IA; DANFE por OCR.
13. Migração das planilhas 2026 (Zé disse "eu vou subir todos os dados" — fazer importador de planilha de acompanhamento, não só de pedido).

---

## 9. Perguntas para o Zé (uma por vez, quando aparecer a situação)

1. Quando chega print sem CNPJ, ele sempre sabe de qual cliente é? (define se "Cliente" é obrigatório no rápido ou pode ficar "a identificar".)
2. O SLA de "pedido sem nota" é o mesmo para as quatro fábricas? Quantos dias?
3. "AGENDADO" na planilha é agendamento de entrega pela transportadora ou pelo cliente?
4. Rudolph: os pedidos já chegam por PDF/Excel ou só por WhatsApp?
5. Girão: filial e matriz compram das mesmas fábricas? Precisa ver separado ou junto?
