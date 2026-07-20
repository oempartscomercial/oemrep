# ADR-012 — Histórico mensal agregado, desacoplado do modelo operacional

**Data:** 2026-07-20 · **Status:** Aceito · Resolve parte de RF39 (backlog V2)

## Decisão
Os dados históricos anteriores ao uso do sistema entram como **totais mensais
agregados** (`HistoricoMensal`: ano, mês, fábrica, tipo PEDIDO/NFE, valor), numa tabela
separada e SEM relação com `Pedido`/`NotaFiscal`. Não há persistência de item,
cliente, número de pedido ou chave de acesso da NFe.

## Por quê
- As planilhas de controle da empresa (pedidos recebidos e NFes emitidas por mês) só
  têm granularidade agregada: mês, fábrica, cliente (nome) e valor. Não têm item,
  quantidade, CNPJ nem chave de acesso (44 dígitos).
- O modelo operacional exige exatamente o que falta (item com referência/quantidade,
  `NotaFiscal.chaveAcesso` única e obrigatória). Forçar o histórico ali dentro
  exigiria inventar dados fictícios, violando a garantia de integridade e a auditoria
  que o sistema foi construído para dar.
- O uso pretendido é só um gráfico de continuidade no dashboard (evolução mensal),
  não a operação (baixa, chamado, rastreio) sobre esses registros.

## Consequência
- Tabela `HistoricoMensal` com `@@unique([ano, mes, fabricaId, tipo])` (chave de
  upsert: reimportar sobrescreve, não duplica).
- Respeita ADR-009: cada linha é vinculada a uma `Fabrica` cadastrada (FK), e as somas
  exibidas são filtradas por fábrica permitida.
- Import restrito a ADMIN (carga de configuração inicial, não operação do dia a dia).
- Evolução futura (consulta line-by-line, quebra por cliente) fica fora deste escopo.
