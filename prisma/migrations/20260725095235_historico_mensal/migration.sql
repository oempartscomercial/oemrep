-- CreateEnum
CREATE TYPE "TipoHistoricoMensal" AS ENUM ('PEDIDO', 'NFE');

-- CreateTable
CREATE TABLE "HistoricoMensal" (
    "id" TEXT NOT NULL,
    "ano" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "fabricaId" TEXT NOT NULL,
    "tipo" "TipoHistoricoMensal" NOT NULL,
    "valor" DECIMAL(14,2) NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HistoricoMensal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HistoricoMensal_ano_mes_fabricaId_tipo_key" ON "HistoricoMensal"("ano", "mes", "fabricaId", "tipo");

-- AddForeignKey
ALTER TABLE "HistoricoMensal" ADD CONSTRAINT "HistoricoMensal_fabricaId_fkey" FOREIGN KEY ("fabricaId") REFERENCES "Fabrica"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
