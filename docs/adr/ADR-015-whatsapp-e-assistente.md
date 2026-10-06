# ADR-015 — WhatsApp e assistente do Rômulo

**Data:** 2026-10-06 · **Status:** Proposto (depende da validação do Rômulo e do piloto da fase 0)
· Complementa o [ADR-013](ADR-013-modulo-crm.md), que deixou o WhatsApp fora do escopo.

## Contexto
O CRM (ADR-013) guarda empresas, contatos, linha do tempo e próximos passos. Duas coisas
ainda dependem de WhatsApp:

1. **Prospecção.** O primeiro contato prioritário é o WhatsApp comercial que a própria empresa
   publica (briefing da pasta `rep`, versão 0.4). Hoje o Rômulo escreve à mão; a IA só
   prepara rascunhos.
2. **Assistente do Rômulo.** Ele não é técnico. Quase tudo ("liguei pra X", "marca pra eu
   ligar sexta", "como está a carteira?") ele deve fazer conversando, por texto ou áudio,
   pelo WhatsApp que já usa. A tela serve para ver e mover (ADR-013).

O que já está decidido ou pesquisado:

- **Dois números separados** (conversa de 06/10/2026): um de prospecção, nunca o do Rômulo,
  e um para o assistente. O Arthur decidiu **testar API não oficial em baixo volume** (Evolution
  Go) na prospecção; nada foi instalado nem enviado.
- **Regras que não mudam** (`CLAUDE.md` da pasta `rep`): nunca inventar dado; **nenhuma
  mensagem sai sem aprovação humana**; só contatos com fonte anotada (publicado pela empresa,
  indicado, ou decisor vindo de base profissional); "não contatar" vale na hora; nunca afirmar
  equivalência de peça sem confirmação da fábrica; confirmar antes de gravar.
- **Pesquisa da pasta** (`prospeccao/operacao-mensagens`, 03/10/2026) concluiu: começar por um
  **motor de acompanhamento** (registrar, decidir próxima ação, parar a cadência quando
  responde), não por chatbot; manter o núcleo **independente do transportador**; para produção
  estável, preferir a **API oficial**.

Fatos que pesam (verificados em 06/10/2026; a Meta muda as regras com frequência, então
reconferir antes de contratar):

- **Opt-in.** A política do WhatsApp Business exige que a pessoa tenha fornecido o número e
  aceitado receber mensagens da empresa, e exige respeitar pedido de parar. Telefone achado em
  site ou base não é, por si só, opt-in. Número que a empresa publica como canal comercial é
  o caso mais defensável, **não uma garantia**.
- **Termos do WhatsApp Business App** (vigentes desde 23/09/2026, segundo a pesquisa da pasta):
  restringem aplicações que interagem com o app sem consentimento e vedam mensagem não
  solicitada. Uma ponte por "aparelho conectado" (Evolution Go, Z-API etc.) **não é o canal
  oficial**: o risco é de bloqueio do número e de descumprimento contratual.
- **API oficial (Cloud API).** Iniciar conversa ou falar fora da janela de 24 horas exige
  *template* aprovado. Cobrança por mensagem entregue, por categoria. Desde 01/10/2026
  mensagens de serviço também são cobradas, com as primeiras 1.000 por número/mês grátis
  ([FAQ da Meta](https://whatsappbusiness.com/resources/faq/)). A tarifa em reais para o Brasil
  **não foi validada**.
- **Assistentes de IA na API oficial.** Desde 15/01/2026 os termos proíbem provedores de IA de
  uso geral, mas permitem assistentes de um negócio específico (suporte, pedidos, FAQ com base
  definida). Fonte: matérias de terceiros (por exemplo
  [Dataslayer](https://www.dataslayer.ai/blog/meta-bans-general-purpose-ai-chatbots-on-whatsapp-business));
  **ler o texto oficial dos termos antes de ir ao ar**.

## Decisão
1. **O núcleo é nosso e não depende do transportador.** A plataforma guarda conversas,
   mensagens, rascunhos, aprovações e supressões, e aplica as regras em funções puras
   (`src/domain/mensagens`, no mesmo padrão do domínio de CRM). O WhatsApp entra por um
   **adaptador** com duas operações (enviar, receber evento) e um contrato único. Há dois
   adaptadores previstos: `evolution` (piloto) e `cloud` (oficial). Trocar um pelo outro não
   muda regra, tela nem histórico.
2. **Duas linhas, com tratamentos diferentes.**
   - **Linha de prospecção** (mensagens a terceiros): número dedicado, descartável, nunca o do
     Rômulo. **Piloto com API não oficial, em baixo volume, e só com as proteções abaixo.**
     Decisão de ir ou não para a API oficial fica para o fim do piloto (critérios na seção
     Fases).
   - **Linha do assistente** (conversa Rômulo ↔ assistente): **API oficial desde o começo.** O
     volume é minúsculo, o custo é desprezível e a perda desse número cortaria a ferramenta
     principal dele. O Rômulo inicia a conversa; mensagens que o assistente inicia fora da
     janela de 24 horas (o resumo das 8h) usam *template* de utilidade. O assistente fica
     **restrito ao CRM da OEM** (sem conversa livre), o que serve ao produto e à política de IA
     da Meta.
3. **Nenhuma mensagem a terceiros sai sem aprovação humana, por mensagem.** Ciclo de vida de uma
   mensagem de saída: `RASCUNHO → APROVADA → ENVIANDO → ENVIADA → ENTREGUE/LIDA`, com
   `FALHOU` e `CANCELADA`. Quem aprovou e quando ficam gravados. Quem aprova pode ser o
   Rômulo pela linha do assistente ("ok") ou um botão na ficha da empresa. **Autoenvio de
   follow-up** só entra depois do piloto e só em casos delimitados (seção Fases).
4. **Proteções fixas, em código, antes de qualquer envio** (a IA não decide isso):
   - Contato e empresa não marcados como "não contatar"; empresa não `DESCARTADA`.
   - Contato com **origem registrada** (publicado pela empresa, indicado, ou base profissional),
     o mesmo vocabulário do `CLAUDE.md` da pasta `rep`. Sem origem, não envia.
   - Sem resposta recente nem intervenção do Rômulo na conversa; sem mensagem duplicada.
   - Dentro do horário comercial e dos limites abaixo.
   - Linha conectada e saudável (sessão ativa).
   Valores iniciais propostos, ajustáveis na tabela `Parametro` e **a validar com o Rômulo**:
   horário seg–sex 8h–18h (America/Sao_Paulo); até **15 primeiros contatos por dia** na linha de
   prospecção; no mínimo **3 dias** entre mensagens ao mesmo contato; no máximo **3 tentativas**
   sem resposta.
5. **Parar tem prioridade absoluta.** Pedido de parar ("parar", "sair", "não quero", "remover")
   é detectado por **regra de texto**, não só pela IA: marca o contato e a empresa como
   `naoContatar`, cancela rascunhos e cadência pendentes e registra na linha do tempo. A IA
   pode classificar os casos ambíguos, mas nunca desfaz uma supressão.
6. **Entrada de mensagens.** Um endpoint de webhook por linha, com segredo validado. **Grava o
   evento bruto antes de processar** (idempotente pelo id externo da mensagem), depois:
   - Casa o número (normalizado, formato E.164) com um `Contato`. Número desconhecido vai para
     uma lista "sem identificar" para revisão; **nunca recebe resposta automática**.
   - Resposta de empresa em prospecção na etapa "Em contato" a move para "Conversando", como
     movimento automático (selo já existente), cria o próximo passo "Responder" para o Rômulo
     e **cancela a cadência pendente**.
   - Mensagem que o Rômulo escreve pelo celular na linha de prospecção também é registrada
     (a conexão por aparelho conectado entrega os dois lados). Isso precisa ser **testado de
     ponta a ponta** no piloto; não se presume importação de conversas antigas.
7. **O papel da IA (Claude) é assistir, nunca decidir.** Classifica a resposta
   (`interesse`, `pergunta/objeção`, `não interessado`, `não contatar`, `ambígua`), resume,
   sugere o próximo passo e escreve o rascunho. Rascunho cita só dado do catálogo aprovado e do
   cadastro; **não afirma equivalência de peça** sem confirmação da fábrica; primeira mensagem
   segue o modelo do `CLAUDE.md` (curta, sem link nem anexo, termina em pergunta).
8. **O assistente do Rômulo usa as mesmas regras do sistema, pela API da plataforma.** Um agente
   com Claude, atrás da linha do assistente, chama ferramentas que correspondem às rotinas
   existentes (hoje, carteira, buscar, ver empresa, registrar contato, agendar, mover etapa),
   com a **permissão do usuário que está falando** (o Rômulo é ADMIN). Regras:
   - **Toda escrita pede confirmação em uma frase** ("Vou anotar: falou com a Ana, ela pediu
     catálogo; próximo passo ligar sexta, 10/10. Pode ser?"). A escrita fica numa ação pendente
     (expira em minutos) e só é aplicada após "sim/ok/pode" reconhecido por regra; resposta
     ambígua repete a pergunta.
   - Empresa em andamento sem próximo passo com data e responsável **não é gravada**: o assistente
     pergunta uma vez.
   - **Áudio:** é transcrito no servidor, a transcrição é mostrada na confirmação e o áudio
     original fica guardado. É provável que seja o modo mais usado dele; a fase 0 confirma.
   - **Resumo diário às 8h**, no máximo uma mensagem por iniciativa do assistente por dia. O
     resto só quando o Rômulo puxa a conversa.
   - Respostas em português simples, curtas, sem jargão nem ids, como no `CLAUDE.md` da pasta.
   - O assistente **nunca** envia mensagem a terceiros: só prepara rascunho para aprovação.
9. **Dados novos (esboço, vira migração na fase 1).**
   - `Conversa`: canal, linha (`PROSPECCAO` ou `ASSISTENTE`), número, contato e empresa (ou
     usuário, na linha do assistente), última entrada.
   - `Mensagem`: direção, origem (`CONTATO`, `ROMULO_NO_CELULAR`, `PLATAFORMA`, `ASSISTENTE`),
     tipo, texto, transcrição, `idExterno` único, status, gerada por IA, quem aprovou e quando,
     erro.
   - `EventoWhatsapp`: payload bruto, recebido em, processado em (replay e idempotência).
   - `Contato`: acrescenta `origemContato` (`PUBLICADO_PELA_EMPRESA`, `INDICACAO`,
     `BASE_PROFISSIONAL`, `RELACIONAMENTO`). A fonte textual que já existe continua.
   - `AcaoPendente` (assistente): a escrita aguardando o "sim".
   Mensagens aparecem na linha do tempo da ficha (ADR-013) como mais um tipo de item.
10. **Onde roda.** Webhooks e telas ficam na plataforma (Vercel + Supabase, ADR-001/002). O
    agendador (resumo das 8h, follow-ups vencidos) usa tarefa agendada; **conferir os limites
    do plano gratuito**, que podem não permitir a frequência necessária. O Evolution Go exige
    um **servidor sempre ligado** (VPS) e uma ativação de licença cujo preço **não foi
    confirmado**: isso contraria o "R$ 0/mês" do ADR-002 e tem de ser aceito de forma explícita
    pelo cliente. A linha oficial (Cloud API) não precisa de servidor próprio.

## Alternativas consideradas
- **API oficial também na prospecção desde já.** É o caminho de menor risco, mas exige
  *template* aprovado para abrir conversa e tem custo por mensagem. Recusado **por enquanto**
  porque o Arthur quer medir resposta em baixo volume antes de pagar; volta à mesa no fim do
  piloto ou se o número for bloqueado.
- **Parceiro oficial (provedor aprovado pela Meta).** Reduz o trabalho de integração e entrega
  a API oficial; cobra uma camada própria. Candidato natural caso a OEM decida pelo oficial.
- **Outras pontes por aparelho conectado (Z-API, Evolution API).** Mesmo risco contratual do
  Evolution Go; sem ganho que justifique trocar. O adaptador único permite testar outra depois.
- **Caixa de entrada compartilhada (Chatwoot).** Opcional, só se o Rômulo e mais alguém
  precisarem responder pela mesma tela. Não é o CRM e não entra agora.
- **Assistente fora do WhatsApp (por exemplo, Telegram).** Sem restrição de política e grátis,
  mas o Rômulo já vive no WhatsApp. Fica como plano B se a Meta barrar o assistente.
- **Não integrar; o Rômulo envia à mão e a IA só escreve o rascunho.** É o estado de hoje.
  Segue válido como plano de contingência e como fase 0.

## Consequências
- O histórico das conversas passa a viver no nosso banco, com id, horário, direção e quem
  aprovou. Isso dá a base para medir resposta e tempo de reação.
- **Risco aceito no piloto:** o número de prospecção pode ser bloqueado ou a sessão cair. Por
  isso é dedicado, descartável e com volume baixo; o assistente e os pedidos nunca dependem
  dele.
- Mensagens que o Rômulo manda do próprio celular fora da linha de prospecção **não** são
  capturadas. O trabalho comercial por esses canais continua sendo registrado pelo assistente.
- Há conteúdo pessoal de terceiros (nome, cargo, telefone, conversas) no banco. Retenção,
  base legal e resposta a pedidos de titular **precisam de revisão jurídica** antes de
  escala; o ADR não faz essa análise.
- O custo deixa de ser zero: VPS e licença do conector (piloto) e, na linha oficial,
  mensagens por categoria. Nenhum valor em reais foi validado.

## Fases e critérios
0. **Manual (1 a 2 semanas, sem código).** O Arthur faz o papel do assistente num número de
   WhatsApp com o Rômulo. Mede: o que ele pede, se manda áudio, quanto de conversa precisa,
   o que a confirmação atrapalha. Decide as perguntas abertas abaixo.
1. **Registro.** Webhook, `Mensagem`, linha do tempo na ficha, **só leitura**. Teste com 10 a
   20 contatos de relacionamento existente ou com permissão documentada. Passa quando 100% das
   mensagens de ida e volta aparecem e a amostra confere com o celular.
2. **Rascunho, aprovação e envio** na linha de prospecção, com supressão, classificação e
   fila diária de follow-ups. IA propõe, humano aprova.
3. **Assistente do Rômulo** na linha oficial: consultas primeiro, depois escritas com
   confirmação, áudio e resumo das 8h.
4. **Follow-up com autoenvio limitado**, só se o piloto mostrar: histórico completo, nenhum
   follow-up indevido, opt-out funcionando e feedback positivo do Rômulo. Mede-se: mensagens
   perdidas, follow-ups no prazo, classificação correta, tempo de reação, avanços qualificados.

## Em aberto
1. O número atual do Rômulo é pessoal, Business App ou já está na plataforma? Qual será o
   número de prospecção e o do assistente? (`perguntas-pendentes.md`)
2. Como o Rômulo prefere aprovar: respondendo "ok" no WhatsApp ou um botão na ficha?
3. Quem responde o assistente quando o Rômulo está fora? Mais alguém usa a linha?
4. Os limites da decisão 4 (horário, 15 por dia, 3 dias, 3 tentativas) servem à rotina dele?
5. Verificar no texto oficial se o assistente restrito ao CRM cabe na política de IA, e se
   existe modo em que a linha do Business App e a API oficial convivem no mesmo número.
6. Preço da ativação do Evolution Go e da tarifa oficial no Brasil; limites do agendador no
   plano gratuito.
7. Retenção das mensagens e base legal (revisão jurídica).

## Fontes
Pesquisa da pasta `rep` (`prospeccao/operacao-mensagens/*`, 03/10/2026) e, nesta data,
[FAQ da plataforma do WhatsApp Business](https://whatsappbusiness.com/resources/faq/) e matérias
sobre os termos de IA de 15/01/2026 (ver Contexto). Nada foi instalado nem enviado.
