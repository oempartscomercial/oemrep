-- CreateEnum
CREATE TYPE "MetodoRastreio" AS ENUM ('SSW', 'MANUAL', 'NAO_MAPEADA');

-- CreateEnum
CREATE TYPE "OrigemEventoRastreio" AS ENUM ('MANUAL', 'AUTOMATICO');

-- AlterEnum
ALTER TYPE "OrigemPedido" ADD VALUE 'RAPIDO';

-- AlterEnum
ALTER TYPE "StatusRastreio" ADD VALUE 'AGENDADO';

-- DropForeignKey
ALTER TABLE "EventoRastreio" DROP CONSTRAINT "EventoRastreio_usuarioId_fkey";

-- AlterTable
ALTER TABLE "EventoRastreio" ADD COLUMN     "local" TEXT,
ADD COLUMN     "origem" "OrigemEventoRastreio" NOT NULL DEFAULT 'MANUAL',
ALTER COLUMN "usuarioId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "NotaFiscal" ADD COLUMN     "modalidadeFrete" TEXT,
ADD COLUMN     "pesoBruto" DECIMAL(12,3),
ADD COLUMN     "previsaoEntrega" TIMESTAMP(3),
ADD COLUMN     "rastreioAtualizadoEm" TIMESTAMP(3),
ADD COLUMN     "rastreioFalhas" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "transportadoraId" TEXT,
ADD COLUMN     "ultimaOcorrencia" TEXT,
ADD COLUMN     "ultimaOcorrenciaEm" TIMESTAMP(3),
ADD COLUMN     "volumes" INTEGER;

-- AlterTable
ALTER TABLE "Pedido" ADD COLUMN     "dataPedido" TIMESTAMP(3),
ADD COLUMN     "modalidadeFrete" TEXT,
ADD COLUMN     "numeroCliente" TEXT,
ADD COLUMN     "observacao" TEXT,
ADD COLUMN     "transportadorPrevisto" TEXT,
ADD COLUMN     "valorTotalDeclarado" DECIMAL(12,2),
ADD COLUMN     "vendedor" TEXT;

-- CreateTable
CREATE TABLE "Transportadora" (
    "id" TEXT NOT NULL,
    "cnpj" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "metodo" "MetodoRastreio" NOT NULL DEFAULT 'NAO_MAPEADA',
    "urlPublica" TEXT,
    "contato" TEXT,
    "observacao" TEXT,
    "criadaAutomaticamente" BOOLEAN NOT NULL DEFAULT true,
    "ultimaConsultaEm" TIMESTAMP(3),
    "ultimaConsultaOk" TIMESTAMP(3),
    "falhasSeguidas" INTEGER NOT NULL DEFAULT 0,
    "issueUrl" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transportadora_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Transportadora_cnpj_key" ON "Transportadora"("cnpj");

-- CreateIndex
CREATE INDEX "NotaFiscal_transportadoraId_idx" ON "NotaFiscal"("transportadoraId");

-- CreateIndex
CREATE INDEX "NotaFiscal_status_idx" ON "NotaFiscal"("status");

-- CreateIndex
CREATE INDEX "Pedido_numeroCliente_idx" ON "Pedido"("numeroCliente");

-- AddForeignKey
ALTER TABLE "NotaFiscal" ADD CONSTRAINT "NotaFiscal_transportadoraId_fkey" FOREIGN KEY ("transportadoraId") REFERENCES "Transportadora"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventoRastreio" ADD CONSTRAINT "EventoRastreio_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

