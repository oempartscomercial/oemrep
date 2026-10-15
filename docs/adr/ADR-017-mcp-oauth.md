# ADR-017 — O Claude se conecta ao CRM por OAuth ("Conectar → Permitir")

**Data:** 2026-10-14 · **Status:** Proposto (revisão do Arthur) · Complementa o
[ADR-016](ADR-016-mcp-claude.md) (servidor MCP); resolve a "saída futura: OAuth no conector"

## Contexto
No ADR-016 o Rômulo conecta o Claude copiando um token: no Claude Code, num `.mcp.json` com
cabeçalho; no claude.ai, dentro da URL (`/api/mcp/<token>`), que fica no log de requisições da
Vercel. Para quem está começando a usar IA, copiar segredo é o passo que trava. O Claude (site,
Desktop e Claude Code) já sabe fazer OAuth com qualquer servidor MCP que siga a especificação de
autorização do MCP (2025-06-18): basta o servidor responder 401 e publicar os metadados.

## Decisão
1. **A plataforma é o servidor de autorização** (não Supabase nem serviço externo). O login
   continua o do Supabase; o OAuth só acrescenta a tela de "Permitir" e os tokens.
2. **Descoberta**: o `/api/mcp` sem token responde 401 com
   `WWW-Authenticate: Bearer resource_metadata="<origem>/.well-known/oauth-protected-resource"`.
   Metadados RFC 9728 (também em `/.well-known/oauth-protected-resource/api/mcp`) e RFC 8414
   (`/.well-known/oauth-authorization-server`). A origem vem de `NEXT_PUBLIC_SITE_URL` ou do host
   da requisição (`x-forwarded-host` na Vercel).
3. **Registro dinâmico** (RFC 7591) aberto em `POST /oauth/register` (tabela `ClienteOAuth`).
   Só `https://` ou `http://localhost`/`127.0.0.1`/`[::1]` como `redirect_uri`, até 10, nome até 80
   caracteres, corpo até 16 KB. Registrar não dá acesso: só um `client_id` para pedir o "Permitir".
4. **Clientes públicos com PKCE S256 obrigatório**, sem segredo de cliente
   (`token_endpoint_auth_methods_supported: ["none"]`). `redirect_uri` tem que ser exatamente um dos
   registrados; se não for (ou o cliente não existir), a tela mostra o erro e **não redireciona**.
   `resource` (RFC 8707), se vier, tem que ser o `/api/mcp` desta origem. Escopo único `crm`
   (escopo desconhecido é ignorado, não recusado).
5. **Tela de consentimento** `GET /oauth/autorizar` (exige login: o proxy manda para
   `/login?proximo=…` e o login volta para lá depois de entrar). Mostra o nome do aplicativo, o que ele
   pode fazer, **para onde a pessoa volta** (host do `redirect_uri`, ou "o Claude Code, neste
   computador") e com qual conta está logado ("Não é você? Sair"). OPERADOR vê a recusa e só pode
   voltar ao Claude. Os botões são um formulário HTML comum para
   `POST /oauth/autorizar/decisao`, que só aceita POST do próprio site (Origin/Sec-Fetch-Site),
   contra CSRF. `/authorize` redireciona para a tela, para cliente que não lê os metadados.
6. **Código de autorização** (`CodigoOAuth`): hash SHA-256, uso único, 5 minutos, preso a cliente,
   `redirect_uri`, desafio PKCE, usuário e recurso. **Queima na primeira tentativa**, certa ou
   errada. Reapresentado depois de usado: o acesso que ele gerou é revogado (RFC 6749 §4.1.2).
7. **Tokens**: o access token é um `TokenApi` (mesmo formato `oem_…`, mesma validação do ADR-016),
   com `origem = OAUTH`, `clienteOAuthId`, `expiraEm` (1 hora), `refreshHash` e `refreshExpiraEm`
   (90 dias, **renovado a cada uso**: quem usa pelo menos uma vez a cada 90 dias não precisa
   autorizar de novo). **Uma linha por autorização**: a renovação troca os hashes na mesma linha
   (rotação: o access e o refresh anteriores deixam de valer na hora), então a lista da tela mostra
   uma conexão, não uma por hora. Revogar a linha derruba os dois. Refresh `oemr_…` e código
   `oemc_…` têm prefixos próprios e nunca passam por token de acesso.
8. **`POST /oauth/token`** aceita form-urlencoded e JSON; `client_id` no corpo (ou no Basic, se
   o cliente insistir; segredo ignorado). Erros no formato OAuth (`invalid_grant`,
   `invalid_request`, `invalid_target`, `unsupported_grant_type`), sempre `Cache-Control: no-store`.
   Revogação RFC 7009 em `POST /oauth/revogar` (200 mesmo para token desconhecido).
9. **CORS aberto** (`*`) nos metadados e nos endpoints de OAuth: nada ali usa cookie. A tela e a
   decisão não têm CORS.
10. **Auditoria**: a troca do código grava `TokenApi` com `nome` e `origem = OAUTH` ("Autorizado no
    Claude (Permitir)"); revogar (na tela, por reuso de código ou pela RFC 7009) grava `revogadoEm`.
    Renovação não é auditada (seria um evento por hora).
11. **Tela "Conectar o Claude"**: o jeito principal é o OAuth (endereço `<origem>/api/mcp` no
    conector do Claude; `.mcp.json` sem cabeçalho no Claude Code). O token manual do ADR-016 fica em
    "Avançado". A lista mostra os dois tipos, com Ativo/Expirado/Revogado e Revogar.
12. Os tokens manuais e a rota `/api/mcp/<token>` **continuam valendo**.

## Consequências
- O Rômulo conecta assim: no Claude, Configurações → Conectores → Adicionar conector
  personalizado → URL `<origem>/api/mcp` → Conectar → o navegador abre já logado → **Permitir**.
- Corrida de renovação: se o Claude mandar o mesmo refresh duas vezes ao mesmo tempo, a segunda
  recebe `invalid_grant` e o Claude pede o "Permitir" de novo. Não há detecção de reuso de refresh
  (que revogaria a conexão inteira), porque o efeito colateral de um retry de rede seria derrubar o
  acesso do Rômulo.
- Registro dinâmico aberto não tem limite de taxa; a tabela `ClienteOAuth` pode crescer com lixo.
  Por ora aceitável (não dá acesso a nada); se incomodar, limitar por IP ou faxinar clientes sem uso.
- Usuário desativado: o access para de valer na hora (mesma regra do ADR-016) e a renovação é
  recusada. Quem tem sessão do Supabase mas foi desativado cai no login, que já explica o motivo.
- Pendente: com o OAuth funcionando no claude.ai, o `/api/mcp/<token>` (token no log da Vercel)
  pode ser aposentado.
