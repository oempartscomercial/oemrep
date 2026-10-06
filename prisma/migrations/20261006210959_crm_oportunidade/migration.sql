-- CreateEnum
CREATE TYPE "EtapaOportunidade" AS ENUM ('A_ABORDAR', 'ABORDADO', 'INTERESSE', 'COTACAO', 'GANHA', 'ADIADA', 'PERDIDA');

-- CreateEnum
CREATE TYPE "TipoOportunidade" AS ENUM ('VENDER_FABRICA_NOVA', 'REATIVAR');

-- AlterTable
ALTER TABLE "Interacao" ADD COLUMN     "oportunidadeId" TEXT;

-- AlterTable
ALTER TABLE "ProximoPasso" ADD COLUMN     "oportunidadeId" TEXT;

-- CreateTable
CREATE TABLE "Oportunidade" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "fabricaId" TEXT NOT NULL,
    "tipo" "TipoOportunidade" NOT NULL,
    "etapa" "EtapaOportunidade" NOT NULL DEFAULT 'A_ABORDAR',
    "motivoPerda" TEXT,
    "observacoes" TEXT,
    "criadoPorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "encerradaEm" TIMESTAMP(3),

    CONSTRAINT "Oportunidade_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Oportunidade_clienteId_fabricaId_idx" ON "Oportunidade"("clienteId", "fabricaId");

-- CreateIndex
CREATE INDEX "Oportunidade_etapa_idx" ON "Oportunidade"("etapa");

-- AddForeignKey
ALTER TABLE "Interacao" ADD CONSTRAINT "Interacao_oportunidadeId_fkey" FOREIGN KEY ("oportunidadeId") REFERENCES "Oportunidade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProximoPasso" ADD CONSTRAINT "ProximoPasso_oportunidadeId_fkey" FOREIGN KEY ("oportunidadeId") REFERENCES "Oportunidade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Oportunidade" ADD CONSTRAINT "Oportunidade_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Oportunidade" ADD CONSTRAINT "Oportunidade_fabricaId_fkey" FOREIGN KEY ("fabricaId") REFERENCES "Fabrica"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Oportunidade" ADD CONSTRAINT "Oportunidade_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
