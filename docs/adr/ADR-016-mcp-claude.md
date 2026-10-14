# ADR-016 — O Claude usa o CRM por um servidor MCP da plataforma

**Data:** 2026-10-14 · **Status:** Proposto (revisão do Arthur) · Responde o "formato da API
usada pelo Claude", deixado em aberto no [ADR-013](ADR-013-modulo-crm.md)

## Contexto
O Rômulo opera o CRM conversando com o Claude. Hoje o Claude da pasta `rep` grava em CSV pela
ferramenta local `ferramentas/crm.py`. O ADR-013 decidiu que o Claude grava "pela API da
plataforma, nunca direto no banco", sem dizer o formato.

## Decisão
1. **Servidor MCP em `/api/mcp`** (Streamable HTTP, sem sessão, respostas JSON), com o SDK
   oficial `@modelcontextprotocol/sdk`. Cabe numa função serverless da Vercel: cada requisição
   cria o servidor já preso ao usuário do token.
2. **Token por usuário** (`TokenApi`): segredo `oem_…` mostrado uma vez na tela "Conectar o
   Claude"; no banco só o hash SHA-256. Revogado vale na hora. Usuário desativado ou OPERADOR
   não entra. Criar e revogar ficam na auditoria.
3. **Duas formas de mandar o token**, o mesmo token:
   - Claude Code: `.mcp.json` com `Authorization: Bearer <token>`.
   - claude.ai (conector personalizado, que não aceita cabeçalho): `/api/mcp/<token>`.
     O código não registra a URL, mas o **log de requisições da Vercel registra o caminho**, com o
     token. Risco aceito por ora; quem tem acesso aos logs já tem acesso ao projeto. Saída
     futura: OAuth no conector.
4. **Mesmas regras das telas.** As regras de gravação que estavam presas nas server actions
   foram para `src/lib/crm` (empresas, contatos, prospecção, busca); a tela e o MCP chamam as
   mesmas funções. O que o Claude grava sai no nome do dono do token, com `Interacao.origem =
   CLAUDE` ("Fulano, pelo Claude" na ficha).
5. **Ferramentas** com paridade com o `crm.py`: `agenda`, `buscar_empresas`, `ver_empresa`,
   `carteira`, `conversas_recentes` (só leitura), `registrar_interacao`, `agendar`,
   `concluir_proximo_passo`, `nova_empresa`, `adicionar_contato`. Nenhuma envia mensagem.

## Consequências
- A carteira usa a mesma conta do `crm.py` (ritmo = mediana dos intervalos; atrasado acima de
  2× o ritmo, mínimo 45 dias; "não voltou" com 1–2 compras e mais de 60 dias), em
  `src/domain/crm/carteira.ts`, sobre o `PedidoHistorico` (planilha), não sobre `Pedido`. São
  sinais para conferir, como no ADR-013.
- `nova_empresa` só **avisa** quando a UF está fora do Norte/Nordeste (regra Rudolph); não
  bloqueia, porque a prospecção pode ser de outra linha.
- `registrar_interacao` com `sem_proximo_passo` encerra o passo aberto mesmo em empresa em
  andamento, e avisa. É a saída explícita para "não tem próximo passo".
