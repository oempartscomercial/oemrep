-- CreateEnum
CREATE TYPE "OrigemContato" AS ENUM ('PUBLICADO_PELA_EMPRESA', 'INDICACAO', 'BASE_PROFISSIONAL', 'RELACIONAMENTO');

-- CreateEnum
CREATE TYPE "StatusMensagem" AS ENUM ('RECEBIDA', 'RASCUNHO', 'APROVADA', 'ENVIANDO', 'ENVIADA', 'ENTREGUE', 'LIDA', 'FALHOU', 'CANCELADA');

-- CreateEnum
CREATE TYPE "TipoEnvio" AS ENUM ('PRIMEIRO_CONTATO', 'FOLLOW_UP', 'RESPOSTA');

-- CreateEnum
CREATE TYPE "ClassificacaoMensagem" AS ENUM ('INTERESSE', 'PERGUNTA_OBJECAO', 'NAO_INTERESSADO', 'NAO_CONTATAR', 'AMBIGUA');

-- CreateEnum
CREATE TYPE "OrigemClassificacao" AS ENUM ('REGRA', 'PESSOA', 'IA');

-- AlterTable
ALTER TABLE "Contato" ADD COLUMN     "origemContato" "OrigemContato";

-- AlterTable
ALTER TABLE "Mensagem" ADD COLUMN     "aprovadaEm" TIMESTAMP(3),
ADD COLUMN     "aprovadaPorId" TEXT,
ADD COLUMN     "classificacao" "ClassificacaoMensagem",
ADD COLUMN     "classificacaoOrigem" "OrigemClassificacao",
ADD COLUMN     "criadaPorId" TEXT,
ADD COLUMN     "enviadaEm" TIMESTAMP(3),
ADD COLUMN     "erro" TEXT,
ADD COLUMN     "geradaPorIa" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "motivoBloqueio" TEXT,
ADD COLUMN     "status" "StatusMensagem" NOT NULL DEFAULT 'RECEBIDA',
ADD COLUMN     "tipoEnvio" "TipoEnvio",
ALTER COLUMN "idExterno" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Mensagem" ADD CONSTRAINT "Mensagem_criadaPorId_fkey" FOREIGN KEY ("criadaPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mensagem" ADD CONSTRAINT "Mensagem_aprovadaPorId_fkey" FOREIGN KEY ("aprovadaPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Mensagens já registradas (fase 1) como enviadas pelo celular do Rômulo: não são rascunho.
UPDATE "Mensagem" SET "status" = 'ENVIADA' WHERE "direcao" = 'SAIDA';
