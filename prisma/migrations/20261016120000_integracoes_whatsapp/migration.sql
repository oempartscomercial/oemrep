-- CreateEnum
CREATE TYPE "TipoIntegracao" AS ENUM ('EVOLUTION', 'CHATWOOT');

-- AlterTable
ALTER TABLE "Mensagem" ADD COLUMN     "agendadaPara" TIMESTAMP(3),
ADD COLUMN     "aprovadaPeloClaude" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Integracao" (
    "tipo" "TipoIntegracao" NOT NULL,
    "url" TEXT NOT NULL,
    "instancia" TEXT,
    "conta" TEXT,
    "segredoCifrado" TEXT NOT NULL,
    "segredoFinal" TEXT NOT NULL,
    "envioAutomatico" BOOLEAN NOT NULL DEFAULT false,
    "webhookSegredoCifrado" TEXT,
    "webhookConfiguradoEm" TIMESTAMP(3),
    "estadoConexao" TEXT,
    "estadoConexaoEm" TIMESTAMP(3),
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "atualizadoPorId" TEXT,

    CONSTRAINT "Integracao_pkey" PRIMARY KEY ("tipo")
);

-- CreateTable
CREATE TABLE "Trava" (
    "chave" TEXT NOT NULL,
    "dono" TEXT NOT NULL,
    "ocupadaAte" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Trava_pkey" PRIMARY KEY ("chave")
);

-- CreateIndex
CREATE INDEX "Mensagem_status_agendadaPara_idx" ON "Mensagem"("status", "agendadaPara");

-- AddForeignKey
ALTER TABLE "Integracao" ADD CONSTRAINT "Integracao_atualizadoPorId_fkey" FOREIGN KEY ("atualizadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Defesa extra para a tabela que guarda segredos (mesmo cifrados): sem política, a API pública
-- do Supabase (anon/authenticated) não lê nada. O Prisma conecta como dono da tabela e não é afetado.
ALTER TABLE "Integracao" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Trava" ENABLE ROW LEVEL SECURITY;
