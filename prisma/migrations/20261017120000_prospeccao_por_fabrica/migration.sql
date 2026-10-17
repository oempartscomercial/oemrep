-- Prospecção por fábrica (decisão do Arthur, 17/10/2026): a fábrica da prospecção mora no
-- vínculo empresa × fábrica do cadastro ("ClienteFabrica"), que aceita várias fábricas; a etapa
-- do funil continua uma só por empresa. Sem mudança de estrutura: só os dados.
--
-- Até aqui toda a prospecção era Rudolph. Liga à Rudolph cada empresa em prospecção (qualquer
-- situação que não seja cliente) ainda sem fábrica. Se a Rudolph não estiver cadastrada, não faz nada.
INSERT INTO "ClienteFabrica" ("id", "clienteId", "fabricaId", "flagAcessoSistema", "tipoConfirmacaoEstoque")
SELECT 'mig_fp_' || md5(c."id" || f."id"), c."id", f."id", false, 'PRESUMIDA'
FROM "Cliente" c
CROSS JOIN (SELECT "id" FROM "Fabrica" WHERE lower("nome") = 'rudolph' ORDER BY "criadoEm" LIMIT 1) f
WHERE c."situacao" <> 'CLIENTE'
  AND NOT EXISTS (SELECT 1 FROM "ClienteFabrica" cf WHERE cf."clienteId" = c."id")
ON CONFLICT ("clienteId", "fabricaId") DO NOTHING;
