# Histórico gerencial (pré-sistema) no dashboard — Design

**Data:** 2026-07-20 · **Status:** Aprovado (brainstorming) · aguardando plano de implementação

## 1. Contexto e motivação

O MVP (Épicos 1–7) está completo, mas nasce "vazio": nenhum pedido ou NFe anterior ao
uso do sistema está nele. A empresa mantém hoje duas planilhas de controle gerencial:

- `PEDIDOS RECEBIDOS - 2026 - COMPACTADA.xlsx` — uma linha por pedido recebido
  (mês, dia, fabricante, cliente, valor sem impostos).
- `NFE EMITIDAS POR MÊS - 2026 - COMPACTADA.xlsx` — uma aba por fábrica (Autoflex,
  Bowden, Seineca, Corven, Bendix), cada uma com dia, mês, valor e número da NFe.

Essas planilhas foram inspecionadas diretamente (amostras reais anonimizadas) durante
o brainstorming. Conclusão importante: **nenhuma das duas tem granularidade de item
nem de NFe individual completa** — sem referência de produto, sem quantidade, sem
CNPJ, sem chave de acesso (44 dígitos). São *controles gerenciais agregados*, não o
dado transacional bruto que o modelo operacional (`Pedido`/`ItemPedido`,
`NotaFiscal`/`ItemFaturado`) exige.

**Decisão consequente:** não forçar esse histórico para dentro das entidades
operacionais (isso exigiria inventar chave de acesso e itens fictícios, violando a
garantia de integridade que o sistema inteiro foi construído para dar). Em vez disso,
criar um registro histórico **separado e simplificado**, cujo único propósito é
alimentar um gráfico de continuidade no dashboard — comparar a evolução mensal de
pedidos e NFes antes e depois do sistema existir.

Isto é uma peça do backlog V2 do PRD (RF39 — migração de dados históricos), mas com
escopo deliberadamente menor que o RF39 original descreve: aqui não é migração
operacional, é histórico gerencial para gráfico.

## 2. Escopo

**Dentro do escopo:**
- Entidade nova `HistoricoMensal` — totais mensais agregados por fábrica e tipo
  (pedido/NFe).
- Import via upload de planilha (upload único; reimportar sobrescreve o mesmo
  ano+mês+fábrica+tipo, mas o fluxo não foi desenhado para uso recorrente).
- Tela de import `/historico/importar`, acesso restrito a perfil **ADMIN**.
- Novo gráfico no dashboard (`/`) somando série histórica + série ao vivo (calculada
  dos dados operacionais já existentes) por mês.
- Respeita permissão por fábrica (ADR-009): a soma exibida a cada usuário só inclui
  fábricas que ele pode ver.

**Fora do escopo (explicitamente rejeitado nesta rodada):**
- Qualquer entidade ou tela de consulta/busca de pedidos ou NFes históricos
  individuais (nome de cliente, número de pedido, número de NFe não são
  persistidos).
- Quebra do gráfico por fábrica ou por cliente (só total geral mensal).
- Mecanismo de reimportação recorrente/agendada.
- Conciliação Autoflex, OCR de DANFE, NFe cancelada/reemitida, alertas de NFe parada —
  seguem no backlog V2, não fazem parte desta feature.

## 3. Modelo de dados

Uma tabela nova, sem relação com `Pedido`/`NotaFiscal`:

```prisma
enum TipoHistoricoMensal {
  PEDIDO
  NFE
}

model HistoricoMensal {
  id        String              @id @default(cuid())
  ano       Int
  mes       Int                 // 1-12
  fabricaId String
  fabrica   Fabrica             @relation(fields: [fabricaId], references: [id])
  tipo      TipoHistoricoMensal
  valor     Decimal             @db.Decimal(14, 2)
  criadoEm  DateTime            @default(now())

  @@unique([ano, mes, fabricaId, tipo])
}
```

`@@unique([ano, mes, fabricaId, tipo])` é a chave de upsert: reimportar a mesma
planilha atualiza os totais existentes em vez de duplicar.

**Nota arquitetural:** esta é uma decisão estrutural nova (entidade fora do domínio
operacional, propositalmente sem granularidade de item). Deve virar um ADR
(`docs/adr/ADR-012-historico-mensal-agregado.md`) no início da implementação,
registrando por que a granularidade foi reduzida deliberadamente — segue a regra de
ouro 5 do CLAUDE.md ("mudou algo estrutural? escreva um ADR").

## 4. Parsing das planilhas

Duas funções puras de domínio, sob `src/domain/historico/`, sem importar
Next/Prisma/Supabase (mesmo padrão de `src/domain/importacao/excel.ts` e
`src/domain/nfe/parser.ts`):

```typescript
type TotalMensal = { ano: number; mes: number; fabricaNome: string; valor: number };

function extrairTotaisPedidos(buffer: Buffer): Promise<TotalMensal[]>;
function extrairTotaisNFe(buffer: Buffer): Promise<TotalMensal[]>;
```

**`extrairTotaisPedidos`** — a planilha de pedidos tem mais de uma aba (na amostra:
`OEM REP - PEDIDOS RECEBIDOS 26` e `DASHBOARD`), e o nome da aba de dados muda a cada
ano (ex.: `...27`, `...28`). Por isso o parser **não busca por nome de aba**: percorre
todas as abas e usa a primeira cuja linha de cabeçalho contém as colunas
`MÊS PEDIDO`, `DIA PEDIDO`, `FABRICANTE`, `VR PEDIDO...` (a linha de cabeçalho real
pode não ser a linha 1 — na amostra é a linha 2, pois a linha 1 é um título mesclado).
Abas sem esse formato de cabeçalho (ex.: `DASHBOARD`, que é derivada por fórmula) são
ignoradas. Deriva `ano`/`mês` da **coluna de data** (`DIA PEDIDO`), não do texto do mês
por extenso — mais robusto. Agrupa e soma o valor do pedido por `ano+mes+FABRICANTE`.
Ignora `CLIENTE` e quaisquer colunas de resumo à direita (fórmulas `SUMIFS`
observadas na amostra).

**`extrairTotaisNFe`** — percorre todas as abas do workbook. Cada aba cujo nome **não**
está na lista conhecida de abas de resumo (`RESUMO GERAL`, `DASHBOARD`,
`CLIENTES VENDEDOR`, `COMISSÃO BACKOFFICE`, e variações observadas) é tratada como o
nome de uma fábrica; usa a coluna `DIA` (data) para `ano`/`mês` e soma `VALOR` por
`ano+mes+nome-da-aba`.

**Aba desconhecida vira decisão explícita, nunca descarte silencioso:** se o parser
encontrar uma aba cujo nome não bate com nenhuma `Fabrica` cadastrada nem está na
allowlist de abas de resumo, ela aparece na tela de revisão como pendência bloqueante
(ver §5) — nunca é ignorada silenciosamente. Isso evita que uma fábrica nova adicionada
à planilha no futuro entre despercebida ou seja descartada sem ninguém perceber.

## 5. Fluxo de import — upload → revisão → confirmação

Tela `/historico/importar`, acesso restrito a perfil **ADMIN** (é carga de dado de
configuração inicial, não operação do dia a dia).

1. **Upload**: dois campos de arquivo independentes — planilha de pedidos e planilha
   de NFes. Podem ser enviados juntos ou em momentos separados.
2. **Análise** (`analisarHistorico` — server action): roda os parsers, cruza cada
   `fabricaNome` encontrado contra `Fabrica.nome` já cadastradas.
   - Fábrica não encontrada → linha bloqueante na revisão: *"Fábrica 'SEINECA' não
     cadastrada. Cadastre-a antes de importar."*, com link para `/fabricas`.
   - Fábrica encontrada → prévia agregada (ano, mês, fábrica, tipo, valor).
3. **Revisão**: grade com todos os totais calculados, destacando quais serão
   **sobrescritos** (já existe `HistoricoMensal` para aquele ano+mês+fábrica+tipo) vs.
   **novos**.
4. **Confirmação** (`confirmarImportacaoHistorico` — server action): grava via
   `upsert` em lote, só após todas as pendências de fábrica serem resolvidas (zero
   erros bloqueantes).

Segue o mesmo padrão de interação já usado em `/pedidos/importar` (Épico 3) e
`/conferencia` (Épico 4).

**Auditoria:** cada `HistoricoMensal` criado ou atualizado grava um `EventoAuditoria`
via `compararCampos`/`registrarAlteracoes` (valor anterior quando for sobrescrita) —
mantém a regra de ouro 4 (auditoria de 100%) mesmo sendo uma entidade fora de
`Pedido`/`NotaFiscal`.

## 6. Gráfico no dashboard

Nova seção no dashboard (`/`), abaixo dos cartões de KPI: **"Pedidos × NFes por
mês"**. Reusa o padrão visual de barra CSS já usado em `/pedidos-x-nfe` (sem nova
dependência de biblioteca de gráfico).

**Duas séries por mês, sem quebra por fábrica ou cliente:**

- **Histórico**: soma de `HistoricoMensal` por `ano+mes+tipo`.
- **Ao vivo**: calculado a partir dos dados operacionais já existentes, via nova
  função pura `calcularTotaisMensaisAoVivo` em `src/domain/analise/` (irmã de
  `gap.ts`):
  - valor de pedido = soma de `quantidadePedida × valorUnitario` dos itens, agrupada
    por mês de `Pedido.criadoEm`.
  - valor de NFe = soma de `NotaFiscal.totalNota`, agrupada por mês de `dataEmissao`.

Ambas as fontes são filtradas por `filtroFabricasPermitidas(usuario)` **antes** de
somar (ADR-009) — um usuário sem acesso a uma fábrica nunca vê o valor dela refletido
no total, nem no histórico nem no ao vivo.

As duas fontes são mescladas por chave `ano-mês` (somando os dois lados, caso haja
sobreposição no mês de transição) e ordenadas cronologicamente **crescente** (mais
antigo → mais recente) — diferente da ordenação decrescente do painel Pedidos×NFe,
porque aqui o objetivo é ver evolução no tempo, não priorizar o mês mais recente.

## 7. Testes

- **Domínio** (`src/domain/historico/__tests__/`,
  `src/domain/analise/__tests__/totaisMensais.test.ts`): Vitest puro, sem banco.
  - Parsers testados com planilhas *fixture* recriando a estrutura real inspecionada
    (dados fictícios, mesmas colunas/abas).
  - Função de mesclagem histórico + ao vivo, incluindo o caso de sobreposição de mês.
  - Caso de aba desconhecida → aparece como pendência, não é descartada.
- **Sem teste de integração Prisma dedicado ao upsert** — mesma convenção já usada no
  projeto (rotas finas de persistência não ganham teste próprio; a regra que importa
  já está coberta no domínio).

## 8. Fora deste spec / decisões explicitamente adiadas

- Perfis diferentes de ADMIN não têm acesso à tela de import.
- Nenhuma tela de consulta line-by-line de histórico.
- Nenhum agendamento/recorrência de reimportação.
- ADR-012 a ser escrito no início da implementação (ver §3).
