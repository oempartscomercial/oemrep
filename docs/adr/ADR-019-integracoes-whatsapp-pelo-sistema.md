# ADR-019 — O WhatsApp de prospecção passa pelo sistema: integrações na tela, envio agendado e MCP

**Data:** 2026-10-16 · **Status:** Proposto (revisão do Arthur) · Continua o
[ADR-015](ADR-015-whatsapp-e-assistente.md) (fase 2) e o [ADR-016](ADR-016-mcp-claude.md) (MCP)

## Contexto
Até aqui o Claude do Rômulo mandava WhatsApp por um script local (`ferramentas/whatsapp.py`, na
pasta `rep`) que chama a Evolution direto, com a chave num arquivo do computador dele. Cada ajuste
exigia mexer no computador do Rômulo, e as mensagens não passavam pelas proteções do sistema. A
Evolution (instância `prospeccao`) já está ligada ao Chatwoot (caixa "WhatsApp Prospecção").
O celular conectado pode ser o pessoal do Rômulo, com conversas pessoais.

## Decisão
1. **O Claude do Rômulo só conhece o MCP do sistema.** O sistema guarda as integrações, envia,
   agenda e recebe. Ferramentas novas no MCP: `preparar_mensagem_whatsapp`,
   `aprovar_mensagem_whatsapp`, `cancelar_mensagem_whatsapp`, `mensagens_whatsapp`,
   `status_whatsapp`. Usam as mesmas regras das telas (`src/lib/whatsapp/mensagens.ts`,
   `despachar`, `verificarEnvio`).
2. **A IA nunca aprova sozinha.** `aprovar_mensagem_whatsapp` aprova no nome do dono do token e
   marca `Mensagem.aprovadaPeloClaude`. A descrição da ferramenta e as instruções do servidor mandam
   mostrar o destinatário e o texto exato e só aprovar com o OK explícito do usuário para aquele
   texto. Não há como o servidor provar que o usuário disse "pode"; o que ele garante é quem
   responde pela aprovação e que as proteções fixas valem igual.
3. **Tela Administração → Integrações (só ADMIN).** Evolution: endereço, chave, instância, envio
   automático, testar conexão, situação do celular, criar instância, QR Code na tela (renova até
   conectar) e configurar o webhook. Chatwoot: endereço, conta e token (só guardar e testar).
4. **Segredos cifrados no banco** (tabela `Integracao`): AES-256-GCM com a chave da variável
   `INTEGRACOES_CHAVE` (32 bytes, hex ou base64). Sem a variável, a tela explica e não salva. O
   segredo salvo nunca volta para a tela (só `••••` e o final, até 4 caracteres) e nunca entra na
   auditoria (só "trocada"). A tabela tem RLS ligado sem política: a API pública do Supabase não lê.
5. **A tela manda; as variáveis antigas são reserva.** O transporte lê a Evolution do banco; sem
   linha no banco, valem `EVOLUTION_URL`/`EVOLUTION_APIKEY`/`EVOLUTION_INSTANCIA_PROSPECCAO` com a
   regra antiga (`WHATSAPP_TRANSPORTE=evolution` + `WHATSAPP_ENVIO_HABILITADO=true`). Com a tela,
   o interruptor é o "Envio automático". Configuração salva que não abre (chave trocada) = envio
   desligado, nunca envio com dado errado.
6. **Webhook.** A tela aponta o webhook da instância para `/api/whatsapp/prospeccao/webhook` com os
   eventos `MESSAGES_UPSERT`, `MESSAGES_UPDATE`, `SEND_MESSAGE` e `CONNECTION_UPDATE`. Só mexe no
   webhook: a integração Evolution → Chatwoot é outra rota e continua. Se a instância já manda o
   webhook para outro endereço, a tela pede confirmação. O segredo é gerado uma vez, guardado
   cifrado e reaproveitado; vai no cabeçalho `x-webhook-secret` **e** na URL (`?segredo=`), porque
   nem toda versão da Evolution manda cabeçalho. O segredo da variável
   `WHATSAPP_WEBHOOK_SEGREDO_PROSPECCAO` continua aceito. Evento de outra instância é ignorado.
7. **Só números da base.** Mensagem (recebida ou digitada no celular) só é guardada se o número é
   de contato cadastrado ou de conversa que já existe; senão nada fica, nem o evento bruto. Grupo,
   status, lista de transmissão e contato sem telefone (`@lid`) também não. Recibo só de mensagem
   nossa. O eco do que o sistema enviou é reconhecido pelo id (ou adotado se chega antes da resposta
   da API). Resposta entra na linha do tempo uma vez por "vez de falar" do contato; quem estava "em
   contato" continua indo para "conversando" com o passo "Responder" (ADR-015).
8. **Agendamento.** Mensagem aprovada pode ter `agendadaPara` (até 30 dias). O envio agendado
   (`enviarAprovadas`) só pega as vencidas e continua aplicando todas as proteções: fora do horário
   comercial, espera a próxima abertura. A idade máxima (7 dias) conta da hora marcada. "Enviar
   agora" tira o agendamento. `despachar` não envia agendada antes da hora.
9. **Cron a cada 5 minutos, de fora.** `GET`/`POST /api/cron/whatsapp` com
   `Authorization: Bearer <CRON_SECRET>`. Uma execução por vez (tabela `Trava`, que funciona atrás
   do pooler do Supabase; advisory lock de sessão não funciona lá); com outra em andamento responde
   200 sem fazer nada. A reserva `APROVADA → ENVIANDO` de cada mensagem continua impedindo envio
   duplo. A Vercel (plano Hobby) só roda cron 1x/dia: o `vercel.json` mantém o diário como rede de
   segurança, e o de 5 minutos fica no Supabase (SQL abaixo, **não aplicado**).

## SQL para o Supabase (pg_cron + pg_net) — aplicar à mão, uma vez
No painel do Supabase: Database → Extensions, ligar `pg_cron` e `pg_net` (ou rodar os `create
extension`). Depois, no SQL Editor, trocando `<CRON_SECRET>` pelo mesmo valor da Vercel e o domínio
se for outro:

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- O segredo fica no Vault, não no texto do job.
select vault.create_secret('<CRON_SECRET>', 'oem_cron_secret', 'Segredo do /api/cron/whatsapp');

select cron.schedule(
  'oem-whatsapp-envio',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://oem-rep.vercel.app/api/cron/whatsapp',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'oem_cron_secret'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
  $$
);
```

Conferir: `select * from cron.job;` e, depois de alguns minutos,
`select status_code, content from net._http_response order by created desc limit 5;` (deve vir
200 com `{"ok":true,...}`). Desligar: `select cron.unschedule('oem-whatsapp-envio');`. Trocar o
segredo: `select vault.update_secret((select id from vault.secrets where name = 'oem_cron_secret'), '<novo>');`
e o mesmo valor na Vercel.

## Consequências
- O script local `whatsapp.py` deixa de ser necessário quando o MCP estiver no ar; a pasta `rep`
  precisa de atualização (CLAUDE.md e rotina `/prospectar` passam a usar as ferramentas do MCP).
- Mensagem respondida pelo Chatwoot sai pela Evolution e volta como "minha": aparece como enviada
  "pelo celular" (origem `ROMULO_NO_CELULAR`), sem distinguir Chatwoot de celular.
- Contato que o WhatsApp esconde atrás de `@lid` (sem telefone) não é guardado: se for um cliente
  real, a conversa dele não aparece no sistema. Era o preço de não guardar conversa pessoal.
- O cron de 5 minutos depende do Supabase chamar a Vercel; se parar, o diário da Vercel (9h) ainda
  solta o que ficou, e "Enviar agora" segue funcionando.
- A conferir com a instância real: o corpo do `/webhook/set` (v2 aninhado em `webhook`), se a
  versão instalada aceita `headers` (se aceitar, tirar o segredo da URL), o formato do
  `SEND_MESSAGE` e do `CONNECTION_UPDATE`, e se o `fetchInstances` traz `ownerJid`.
