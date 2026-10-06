# ADR-013 — Módulo de CRM dentro da plataforma, com cadastro único de empresa

**Data:** 2026-10-06 · **Status:** Aceito · Revê ADR-003 e ADR-012 para o histórico por
cliente · Refina ADR-009 para o CRM · Contexto completo em
[`docs/design/2026-10-06-crm-contexto.md`](../design/2026-10-06-crm-contexto.md)

## Contexto
A OEM decidiu ter um CRM próprio e enxuto (decisão de 03/10/2026, registrada na pasta
operacional do Rômulo). Hoje esse CRM é uma ferramenta local sobre arquivos CSV: 66
empresas (clientes e prospecção Rudolph), 37 contatos e 274 linhas de pedidos de 2026
por cliente. O Rômulo opera conversando com o Claude. O CRM precisa ir para a nuvem
para rodar automações e integrar o WhatsApp, e precisa de poucas telas.

Esta plataforma ainda não está em produção. Mudanças de banco custam pouco agora e
viram migração depois do go-live.

## Decisão
1. **O CRM é um módulo desta plataforma, não um sistema separado.** Ele usa o mesmo
   Postgres, o mesmo login, o mesmo design system (ADR-011) e a mesma convenção de
   regras em funções puras em `src/domain/`. O Claude do Rômulo grava pela API da
   plataforma, nunca direto no banco.
2. **Um cadastro só de empresa.** `Cliente` passa a guardar também a prospecção:
   - `cnpj` vira **opcional** (continua único quando preenchido). O pedido pode ser
     lançado para empresa sem CNPJ; o CNPJ só é exigido na conferência da NFe: se
     nenhuma empresa tem o CNPJ da nota, a tela oferece as empresas sem CNPJ com pedido
     aberto naquela fábrica, e a confirmação grava o CNPJ da nota na escolhida (com
     auditoria). Decisão do Arthur, 06/10/2026.
   - Ganha `situacao`: `CANDIDATA → APROVADA → EM_CONTATO → CONVERSANDO → AVANCO`, mais
     `PAUSADA`, `DESCARTADA` e `CLIENTE`. Ganha também cidade, UF, site, origem e
     `naoContatar`.
   - **O primeiro pedido cadastrado torna a empresa `CLIENTE` automaticamente.**
   - O modelo mantém o nome `Cliente` no código; as telas dizem "Empresas". Renomear
     tocaria pedidos, conferência e testes sem ganho funcional.
3. **Novas entidades do CRM:**
   - `Contato`: pessoa ou canal da empresa (nome, função, canal, valor, para que serve),
     com **fonte obrigatória** e `naoContatar`.
   - `Interacao`: linha do tempo da empresa (canal, resumo, data, autor). O autor é um
     usuário ou a automação.
   - `ProximoPasso`: ação, prazo e responsável (`Usuario`). **Empresa em situação ativa
     (de `APROVADA` a `AVANCO`) tem sempre um próximo passo aberto.**
   - `Oportunidade`: card do funil da carteira, um **cliente + uma fábrica**, com tipo
     `VENDER_FABRICA_NOVA` (cliente ainda não compra a fábrica) ou `REATIVAR` (já comprou).
     Só existe para quem já é `CLIENTE`, e só uma aberta por cliente × fábrica. Fica ganha
     sozinha quando chega pedido daquele cliente naquela fábrica. As fábricas que o cliente
     ainda não compra saem de `ClienteFabrica`.
   - **Etapas da carteira** (propostas em 06/10/2026, a validar com o Rômulo): `A_ABORDAR`
     (ideia, ninguém falou) → `ABORDADO` (falou, espera resposta) → `INTERESSE` (pediu
     catálogo, tabela ou conversa) → `COTACAO` (cotação enviada, espera decisão). Fora do
     quadro: `GANHA` (só automática), `ADIADA` (pede data de retomada) e `PERDIDA` (pede
     motivo; pode reabrir). Etapa em andamento (`ABORDADO` a `COTACAO`) exige próximo passo
     com data e responsável, como no funil de prospecção. O passo e a linha do tempo da
     oportunidade são dela (`oportunidadeId`) e não se misturam com os da empresa.
   - **Sugestão, não previsão.** A tela lista "fábricas que o cliente ainda não compra",
     que é fato do cadastro. Nada de inferir recompra, churn ou venda perdida só da
     planilha de 2026 (pasta `rep/carteira`). A rede `FILIAL-xx` fica fora das sugestões
     até o Rômulo dizer quem são.
4. **Dois funis com arraste.** O outbound usa a empresa como card; a carteira usa a
   oportunidade.
   - Soltar o card numa etapa ativa exige próximo passo com data, e cancelar devolve o
     card ao lugar de origem.
   - `PAUSADA` pede data de retomada. `DESCARTADA` pede motivo e oferece "não contatar".
   - Toda mudança vira `Interacao` com origem, destino, quem e quando.
   - Mudanças feitas pela automação aparecem marcadas como tal.
5. **Histórico de pedidos por cliente** em tabela própria (`PedidoHistorico`: data,
   cliente, fábrica, valor, linha de origem, alertas de qualidade), separada de `Pedido`
   e de `NotaFiscal`. Segue o raciocínio do ADR-012: nada de item, quantidade ou chave
   de NFe inventados. Linhas suspeitas de duplicidade ficam marcadas e fora das somas.
   `HistoricoMensal` continua servindo ao gráfico do dashboard.
6. **Visibilidade:** `ADMIN` e `ANALISTA` veem todas as empresas e os dois funis.
   `OPERADOR` não vê o CRM. Na ficha da empresa, pedidos e NFes continuam filtrados por
   fábrica permitida (ADR-009).
7. **Telas:**
   - **Início:** o dashboard atual mais as tarefas do CRM na fila do dia.
   - **Funis**, com as duas abas.
   - **Empresas:** substitui Cadastros > Clientes.
   - **Ficha da empresa.**
   - **Busca global.**

   Pedidos e o resto do MVP não mudam.
8. **Fora deste ADR:** WhatsApp, automações e envio de mensagens. Cada um terá ADR
   próprio. Nenhum envio automático sem aprovação humana.
9. **Ordem:** as mudanças de banco entram **antes do go-live** dos pedidos. As telas
   do CRM viram o Épico 8, **depois** que o MVP de pedidos estabilizar. O CRM não pode
   atrasar a entrada dos pedidos em produção.

## Por quê
- Dois cadastros da mesma empresa (CRM e pedidos) divergiriam. Com um só, a conversão
  de prospecção em cliente acontece sozinha, no primeiro pedido.
- `ClienteFabrica` e `Pedido` já dizem o que cada cliente compra. O funil de expansão
  nasce desses dados, sem digitação.
- Login, design system, hospedagem e auditoria já existem aqui. Um sistema separado
  repetiria tudo isso.
- Sem histórico por cliente não dá para saber quem parou de comprar, que é a primeira
  pergunta do Rômulo sobre a carteira.

## Consequências
- A conferência deixa de casar só por CNPJ (RN04): quando o CNPJ da nota não existe,
  quem confere escolhe a empresa, e o CNPJ passa a valer dali em diante.
- Cadastros > Clientes é absorvida por Empresas.
- A importação inicial traz as 66 empresas, os contatos, as interações e o histórico da
  pasta local, deduplicando por CNPJ contra os clientes já cadastrados.
- A regra de auditoria de 100% (pedidos e NFes) não muda. No CRM, a própria
  `Interacao` é o histórico.
- Ficam em aberto, para validar com o Rômulo: as etapas do funil da carteira, o
  provedor e o número do WhatsApp, e o formato da API usada pelo Claude.
