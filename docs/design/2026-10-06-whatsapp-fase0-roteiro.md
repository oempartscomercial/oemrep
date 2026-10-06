# WhatsApp, fase 0: você faz o papel do assistente

**Data:** 2026-10-06 · Roteiro da fase 0 do [ADR-015](../adr/ADR-015-whatsapp-e-assistente.md)
· Para o Arthur conduzir, com o Rômulo, por 1 a 2 semanas. **Sem código.**

## O que estamos testando
Antes de construir o assistente, descobrir **como o Rômulo realmente fala com ele**. Você
responde à mão, usando os dados reais, e anota tudo. O que sair daqui decide o desenho da
fase 3. Hipóteses a confirmar ou derrubar:

1. Ele resolve quase tudo com **poucos tipos de pedido** (hoje, carteira, registrar, ver
   empresa, rascunho, avaliar candidatas). Se aparecer muita coisa fora disso, o assistente
   precisa ser mais amplo do que o previsto.
2. Ele manda **áudio** com frequência. Se sim, a transcrição vira prioridade.
3. A **confirmação antes de gravar** ("Vou anotar: … Pode ser?") ajuda e não irrita.
4. Um **resumo às 8h** é útil, e ele lê e age em cima dele.
5. Ele aprova rascunhos de mensagem **respondendo "ok" no WhatsApp**, sem precisar de tela.
6. Ele usa o assistente **sozinho**, sem ninguém explicar de novo a cada dia.

## Antes de começar (uma vez)
- **Um número de WhatsApp só para isso.** Pode ser um chip reserva com o WhatsApp Business no
  seu celular. **Nunca o número pessoal do Rômulo** nem o seu pessoal. Nesta fase não usa API
  nenhuma; é só o app.
- **Os dados à mão, no mesmo dia.** Você responde pelos dados reais: a plataforma local
  (`npm run dev`, banco com os dados da pasta `rep`) ou a pasta `rep` (`ferramentas/crm.py`).
  Deixe as duas abertas: Início, Funis, Empresas e a ficha são sua "tela de consulta".
- **Combinados fixos com você mesmo** (são as regras do assistente de verdade, o `CLAUDE.md`
  da pasta `rep`):
  - Português simples, como WhatsApp. Respostas curtas. **Uma pergunta por vez.**
  - Sem jargão, sem id técnico, sem nome de arquivo.
  - **Nunca inventar dado.** Se não está na base, diga que não sabe.
  - **Antes de gravar, confirmar em uma frase.** Só grava depois do "sim".
  - Empresa em andamento sem **próximo passo com data e responsável**: pergunte uma vez.
  - Valores e datas no padrão brasileiro, com o dia da semana nos prazos.
  - **Você nunca escreve a terceiros a partir deste número.** Só prepara o rascunho; **o
    Rômulo envia** do número dele.
  - Pedido recebido **não é faturamento**.
- **Janelas de atendimento.** Combine duas por dia (por exemplo 9h e 14h) e responda em até
  15 minutos dentro delas. O assistente real será instantâneo; aqui o que importa é o
  conteúdo, mas anote quando ele escreve fora da janela e o que esperava.
- **Aviso de privacidade ao Rômulo:** você vai ler as mensagens dele. É um teste, e ele pode
  parar quando quiser.

## Mensagem de abertura ao Rômulo
Mande no dia 0, de preferência depois de uma conversa curta ao vivo:

> Rômulo, este é o número do seu assistente de testes. Você pode me mandar mensagem ou áudio
> como falaria comigo: "liguei pra fulano e ele pediu catálogo", "o que eu tenho pra hoje?",
> "como está a Cyro?". Eu respondo e, antes de anotar qualquer coisa, te mostro o que vou
> anotar e peço seu "sim". Não escrevo para nenhum cliente: quando precisar de mensagem, te
> mando o rascunho e você envia. Nos primeiros dias vou responder dentro de umas horas
> (depois fica na hora). Se algo ficar estranho, é só dizer "não entendi".

## Plano
| Dia | O que fazer |
|---|---|
| **0** | Montar o número, abrir os dados, conversa ao vivo de 10 minutos com o Rômulo, mensagem de abertura. Peça só: **"me conta o que você fez hoje com clientes"**, para ele pegar o jeito. |
| **1 a 3** | **Resumo às 8h** todo dia, escrito por você (modelo abaixo). Responda o que ele pedir. Registre. **Não induza**: deixe-o mandar o que quiser, inclusive áudio. |
| **2** | Peça o **primeiro caso real de registro**: "se você falou com alguém hoje, me conta". Teste a confirmação antes de gravar (grave de verdade na plataforma local). |
| **4** | **Avaliar candidatas.** "Quer ver as empresas para avaliar?" Mostre **uma por vez** (nome, cidade, o que já se sabe) e registre abordaria/não abordaria/dúvida. É uma tarefa pendente do Rômulo e testa o fluxo de um item por vez. |
| **5** | **Rascunho de mensagem.** Peça: "preciso escrever para uma empresa da lista". Mande o rascunho no modelo do `CLAUDE.md` (curto, sem link, termina em pergunta). Veja se ele aprova com "ok" ou reescreve. **Quem envia é ele.** |
| **6 a 7** | **Carteira.** Deixe ele perguntar "quem parou de comprar?" e "como está a Cyro?". Responda só com fato do cadastro (último pedido recebido, fábricas que compra, última conversa), **sem prever recompra nem churn** (a pasta `rep/carteira` proíbe). Teste também "oferecer outra fábrica": use as ideias de expansão do funil da carteira. |
| **8 a 9** | **Perguntas pendentes**, uma por dia (`rep/perguntas-pendentes.md`): as FILIAL-xx, os pedidos de 21/05, a região da Rudolph, o número de prospecção. Anote as respostas lá, no modelo de sempre. Bônus: destrava dados que o sistema precisa. |
| **10** | Conversa de 20 minutos com ele para fechar (roteiro de decisão abaixo). Decida e atualize o ADR. |

Se ele ficar dois dias sem escrever, **não cobre por mensagem fora do resumo**. Anote. Se o
assistente real também ficaria calado, isso é um dado.

## Modelos de mensagem

**Resumo das 8h** (curto, no máximo 5 itens, termina com sugestão):
> Bom dia, Rômulo! Hoje (qua, 07/10):
> 1. Ligar para a Dispetral (passo que vence hoje)
> 2. Cobrar resposta da cotação Corven para a Cyro (atrasado desde segunda)
> 3. Duas empresas esperando sua avaliação
> Quer começar pela Dispetral?

**Confirmação antes de gravar:**
> Vou anotar: falou com a Ana, do compras da Real Trator, por WhatsApp; ela pediu catálogo.
> Próximo passo: ligar sexta, 09/10, você. Pode ser?

**Quando não sabe:**
> Isso eu não tenho na base. Quer que eu anote como pergunta para a Dispetral ou você me conta?

**Rascunho para aprovar:**
> Rascunho para a Real Trator:
> "Olá, tudo bem? Sou o Rômulo, da OEM Rep. Representamos a Rudolph, fábrica de peças de
> transmissão para tratores. Vi que vocês trabalham com [peça vista no site]. Quem cuida da
> compra dessa linha aí? Gostaria de apresentar nosso catálogo."
> Responde "ok" que eu deixo pronto para você enviar, ou me diz o que mudar.

## Registro (a parte que mais vale)
Uma linha por troca que importa. Modelo em
[whatsapp-fase0-registro.csv](2026-10-06-whatsapp-fase0-registro.csv):

| Campo | Para quê |
|---|---|
| quando | dia e hora da mensagem dele |
| formato | texto, áudio, foto, planilha, outro |
| pedido | em uma frase, o que ele quis |
| tipo | hoje, carteira, registrar, ver empresa, rascunho, avaliar, pergunta pendente, outro |
| precisou_perguntar | você teve que fazer pergunta de esclarecimento? (sim/não) |
| gravou | houve escrita no sistema? (sim/não) |
| confirmacao | sim, corrigiu, recusou, ignorou |
| erro | o que deu errado, se deu (dado faltando, ambíguo, fora de escopo) |
| tempo_resposta | minutos até você responder |
| reacao | pareceu satisfeito, confuso, impaciente, desistiu |
| observacao | o que o assistente real precisaria fazer diferente |

Guarde também os **áudios** (só para ouvir depois; apague ao fim do teste). Anote todo pedido
**fora** da lista de tipos: ele diz o que o assistente precisa cobrir que não previmos.

## Conta do fim
Preencha no dia 10. Os cortes são **sugestão** para decidir sem achismo; ajuste se o volume
for muito pequeno.

| Pergunta | Sugestão de corte para seguir |
|---|---|
| Quantos dias ele usou? | ao menos 5 de 10 |
| Quantos pedidos ele fez? | volume suficiente para avaliar (30 ou mais) |
| Quanto cabe nos tipos previstos? | cerca de 80% ou mais |
| Quantas confirmações ele recusou ou corrigiu? | menos de 1 em 5 |
| Quantos pedidos precisaram de pergunta de esclarecimento? | menos de 1 em 3 |
| Quanto mandou em áudio? | define se a transcrição entra já na fase 3 |
| Aprovou rascunho com "ok"? | sim em pelo menos 3 de 5 |

## Decisões que saem daqui (fecham o "Em aberto" do ADR-015)
Leve estas perguntas à conversa final e anote a resposta dele:

1. **Aprovação:** ele prefere responder "ok" no WhatsApp ou clicar num botão na ficha?
2. **Áudio:** ele vai usar? Em que situação (dirigindo, depois do atendimento)?
3. **Horário do resumo:** 8h serve? Prefere sem resumo, ou duas vezes por dia?
4. **Limites** da prospecção (8h–18h, 15 primeiros contatos por dia, 3 dias entre mensagens,
   3 tentativas): servem à rotina dele?
5. **Quando ele não está:** alguém mais precisa usar o assistente? Quem?
6. **Números:** qual será o de prospecção e qual o do assistente? Hoje o número dele é
   pessoal, Business App ou outro?
7. **O que sentiu falta:** pedidos que o assistente deveria resolver e não resolveu.

## Resultado esperado
Ao fim você tem: o registro preenchido; a lista de pedidos fora do previsto; as respostas às
sete perguntas; e, de bônus, algumas das perguntas pendentes respondidas. Com isso:

- Atualize o **ADR-015** (status de Proposto para Aceito, ou Revisado, e as decisões em
  aberto).
- Mude o desenho da fase 3 se a hipótese 1, 2 ou 5 caiu.
- Se ele usou pouco ou travou na confirmação, **não construa o assistente**: volte a rodar
  só o resumo diário e o rascunho, e reavalie.

## Cuidados
- **Não escreva a nenhum terceiro** por este número.
- **Dados de terceiros** (telefones, nomes de compradores) só aparecem se o Rômulo pedir a
  ficha. Não copie para o registro; anote "pediu ficha da empresa X".
- **Apague** os áudios e o histórico do número ao fim do teste ou depois de decidir.
- Este teste **não valida** nada sobre prospecção em WhatsApp (isso é a fase 1 e a 2). Só
  valida como o Rômulo conversa com o assistente.
