# ADR-020 — Prospecção por fábrica: o vínculo empresa × fábrica diz para quem se prospecta

**Data:** 2026-10-17 · **Status:** Aceito · Refina o [ADR-013](ADR-013-modulo-crm.md) (funil de
prospecção)

## Contexto
A prospecção começou só pela Rudolph, mas vai abranger as outras fábricas (Autoflex, Bowden,
Seineca/H3, Bendix, Corven). O Rômulo trabalha uma fábrica por dia e precisa ver só o funil dela.
O cadastro já tinha o vínculo empresa × fábrica (`ClienteFabrica`), que para cliente quer dizer
"fábricas que compra" e que a ficha já deixava marcar, como opcional, em empresa de prospecção.

## Decisão (Arthur, 17/10/2026)
1. **A fábrica da prospecção mora em `ClienteFabrica`**, ligado ao cadastro de Fábrica (nada de
   etiqueta de texto livre). Para empresa em prospecção, o vínculo diz "prospecção para"; para
   cliente, continua "fábricas que compra". Sem tabela nova.
2. **Uma empresa pode ser prospectada para várias fábricas.** A etapa do funil continua **uma só
   por empresa**: a empresa aparece no funil de cada fábrica marcada, na mesma etapa, com o mesmo
   próximo passo.
3. **Cliente não muda fábrica pela prospecção.** Oferecer outra fábrica a um cliente é oportunidade
   da carteira (ADR-013). O Claude recebe essa recusa ao tentar.
4. **As empresas que já estavam em prospecção viraram Rudolph** (migração
   `20261017120000_prospeccao_por_fabrica`, só dados: liga à Rudolph toda empresa que não é cliente
   e ainda não tem fábrica). A carga local da pasta rep faz o mesmo.
5. **Filtro no funil de prospecção:** Todas as fábricas · uma fábrica · Sem fábrica. A escolha fica
   num cookie (`oem_funil_fabrica`, um ano) e volta na próxima visita; fábrica desativada volta
   para "todas". O cartão mostra as fábricas da empresa.
6. **Alerta da região** (Rudolph só no Norte e Nordeste) só aparece quando a prospecção é Rudolph
   ou ainda não tem fábrica.
7. **MCP:** `agenda` e `buscar_empresas` aceitam `fabrica`; `nova_empresa` aceita `fabricas`;
   `registrar_interacao` aceita `incluir_fabricas`/`tirar_fabricas`; `ver_empresa` mostra
   "PROSPECÇÃO PARA". A fábrica é dita pelo nome ("rudolph", "h3").

Regras puras em `src/domain/crm/fabrica-prospeccao.ts`; banco em `src/lib/crm/fabricas-prospeccao.ts`.

## Consequências
- Quando a empresa vira cliente no primeiro pedido, o vínculo da fábrica do pedido entra como
  "compra" (como antes); as fábricas que eram só de prospecção continuam marcadas e passam a ser
  lidas como "compra". Se isso incomodar, a conversão pode limpar os vínculos sem pedido.
- Etapa por fábrica (a mesma empresa em etapas diferentes em cada funil) exigiria uma tabela
  própria de prospecção por fábrica. Fica para quando o uso pedir.
