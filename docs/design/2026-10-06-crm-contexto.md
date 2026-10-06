# Módulo de CRM — contexto e direção de UX

**Data:** 2026-10-06 · Conversa entre Arthur e Claude · Decisões formais no
[ADR-013](../adr/ADR-013-modulo-crm.md)

Leia este arquivo antes de qualquer trabalho no CRM. Ele explica de onde a decisão veio,
o que já foi combinado sobre a UX e o que ainda está em aberto.

## De onde vem

- A OEM é uma representação comercial: vende peças de fábricas (Autoflex, Bowden,
  Seineca/H3, Bendix, Corven e, desde agosto de 2026, Rudolph) para distribuidores e
  lojas de autopeças e de peças de trator. O dono, Rômulo, concentra a venda e o
  relacionamento. Ele não é técnico e está começando a usar IA.
- O CRM tem dois lados:
  - **Carteira:** quem parou de comprar e que outras fábricas oferecer a cada cliente.
  - **Prospecção (outbound):** achar e acompanhar empresas novas, começando pela linha
    Rudolph.
- Hoje ele opera pela pasta `~/Documents/Dev/Outros/rep`. Ali o Claude é a interface e
  uma ferramenta local (`ferramentas/crm.py`) lê e grava CSVs em `dados/`. As regras de
  negócio do CRM estão no `CLAUDE.md` dessa pasta e valem para o módulo.
- Em 03/10/2026 a OEM descartou Attio, HubSpot e CRM open source e decidiu por um CRM
  próprio e enxuto (`rep/docs/adr/0001-crm-proprio-para-operacao-comercial.md`).
- Em 06/10/2026 o Arthur decidiu:
  - O CRM vai para a **nuvem**, para rodar automações, e com **WhatsApp integrado**.
  - Ele vive **dentro desta plataforma** (ADR-013), não como sistema separado.
  - A **maior preocupação é UX**. A funcionalidade não tem nada desafiador.

## Regras de negócio que vêm da operação (não negociáveis)

- **Nunca inventar dado** (empresa, CNPJ, telefone, e-mail, comprador, valor). Todo
  contato tem fonte anotada. Nunca deduzir e-mail pelo padrão do domínio.
- **Pedido recebido não é faturamento.** Não usar "faturou" ou "receita" para pedidos.
- **Toda empresa em andamento tem próximo passo com data e responsável.**
- **Cliente atual não entra em lista de prospecção.**
- **"Não contatar" vale na hora** e bloqueia qualquer mensagem futura.
- **Nenhuma mensagem sai sem aprovação humana.**
- Primeiro contato de prospecção: WhatsApp comercial publicado pela empresa, depois
  e-mail de Compras, depois telefone.
- Dúvidas conhecidas da planilha de pedidos:
  - Os rótulos "FILIAL-xx" são de uma rede ainda não identificada e somam 77% do valor.
  - 5 pedidos de 21/05 parecem lançados em dobro.
  - Datas no dia 1 podem indicar só o mês.

## Princípio de UX

Quase tudo o Rômulo faz **conversando com o Claude** (registrar ligação, marcar tarefa,
pedir rascunho de mensagem, perguntar sobre a carteira). A tela serve para **ver e
mover**, inspirada no HubSpot mas **muito mais enxuta**. O que já existe na
plataforma (login, Untitled UI, identidade da OEM) é reaproveitado.

## Telas combinadas

Menu: **Início · Funis · Empresas · Pedidos**, com **busca global** sempre visível.

1. **Início.** É o dashboard atual da plataforma, com as tarefas do CRM entrando na
   fila do dia.
   - Em cima, o que pede ação: atrasados, o que vence hoje, respostas novas no WhatsApp
     e empresas esperando avaliação.
   - Embaixo, poucos números: pedidos recebidos no mês por fábrica (pedido, não
     faturamento), clientes parados e contagem por etapa dos funis.
2. **Funis**, com duas abas.
   - **Outbound:** o card é a empresa. Etapas: candidata → aprovada → em contato →
     conversando → avanço. Pausada e descartada ficam fora do quadro, num filtro.
   - **Carteira:** o card é a oportunidade (**cliente + fábrica**, ex.: "Cyro: oferecer
     Bowden"). Reativar cliente parado é um tipo de card, não um terceiro funil. As
     etapas ainda precisam ser validadas com o Rômulo.
3. **Empresas.** Lista única com filtros rápidos (Clientes · Prospecção · Todas), no
   lugar de submenu. Substitui Cadastros > Clientes. Os contatos ficam dentro da ficha,
   sem tela própria; a busca acha uma pessoa e abre a empresa dela.
4. **Ficha da empresa.** É a tela mais importante.
   - No topo: situação, próximo passo com data e responsável.
   - Depois, uma linha do tempo única com interações, mensagens de WhatsApp, mudanças
     de etapa e pedidos.
   - Por fim, os contatos com fonte e os pedidos por fábrica, que levam às telas de
     pedido existentes.
5. **Pedidos.** As telas que já existem. Gerar e acompanhar pedido é o MVP atual.

Fora por enquanto: caixa de entrada de conversas (as conversas aparecem na ficha), tela
de tarefas (estão no Início) e relatórios.

## Arraste no funil (decidido: pode arrastar)

- **Etapa ativa:** soltar o card abre uma janelinha com próximo passo, data e
  responsável (padrão Rômulo). Não confirma sem data. Cancelar devolve o card.
- **Pausada:** pede data de retomada. **Descartada:** pede motivo e oferece "não
  contatar mais".
- **Linha do tempo:** toda mudança vira um item na ficha, com quem, quando e de onde
  para onde. Voltar etapa é permitido.
- **Movimento automático:** o sistema move cards sozinho (resposta no WhatsApp →
  conversando; pedido chegou → oportunidade ganha). Esses cards ganham um selo de
  "movido automaticamente".
- **Celular:** arrastar funciona mal. Lá o card tem um botão "mover para…" com a mesma
  janelinha.

## WhatsApp e automação (direção, ainda sem ADR)

- **Dois números separados.**
  - **Número de prospecção:** o Rômulo continua usando no app do celular. Evolution ou
    Z-API entra como aparelho conectado, e um webhook grava as conversas na linha do
    tempo.
  - **Número do assistente:** o Rômulo manda texto ou áudio ("liguei pra X…"), o
    agente confirma antes de gravar e manda um resumo do dia às 8h.
- **Aprovação de envio:** o assistente manda o rascunho e o Rômulo responde "ok" ou
  corrige.
- **Volume de mensagens:** no máximo uma mensagem por iniciativa do assistente por dia
  (o resumo). O resto só quando o Rômulo puxa conversa.
- **Validação barata antes de construir:** durante 1 a 2 semanas, o Arthur faz o papel
  do assistente à mão num número de WhatsApp.
- **Arquitetura:**
  - Postgres desta plataforma.
  - As regras do `crm.py` viram API.
  - Um agente com Claude atrás do número do assistente, usando essa API como
    ferramenta.
  - Um webhook do número de prospecção.

## Sequência

1. ADR-013 e mudanças de banco **antes do go-live** dos pedidos.
2. O Rômulo segue na pasta local enquanto isso, e o uso real informa a tela.
3. **Protótipo clicável com dados reais**, para validar a UX com o Rômulo.
4. **Épico 8 (CRM)**, depois que o MVP de pedidos estabilizar, nesta ordem:
   - Ficha, Empresas e busca.
   - Funis com arraste.
   - Tarefas no Início.
   - Importação dos dados da pasta local.
5. WhatsApp e automações por último, com ADR próprio.

## Em aberto

- Etapas do funil da carteira.
- Provedor de WhatsApp (Z-API ou Evolution) e qual número usar para prospectar.
- Se o Rômulo passa o dia no computador ou no celular. Isso define o peso do layout
  mobile.
- Formato da API que o Claude da pasta `rep/` vai usar.
- Perguntas pendentes do Rômulo sobre a planilha e a Rudolph
  (`rep/perguntas-pendentes.md`).
