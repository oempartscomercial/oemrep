-- CreateEnum
CREATE TYPE "EstadoImportacao" AS ENUM ('EXTRAINDO', 'AGUARDANDO_REVISAO', 'CONFIRMADA', 'DESCARTADA', 'FALHOU');

-- AlterEnum
ALTER TYPE "OrigemPedido" ADD VALUE 'PDF';

-- AlterTable
ALTER TABLE "ItemFaturado" ADD COLUMN     "valorUnitario" DECIMAL(12,4) NOT NULL;

-- AlterTable
ALTER TABLE "ItemPedido" ALTER COLUMN "valorUnitario" SET DATA TYPE DECIMAL(12,4);

-- AlterTable
ALTER TABLE "Pedido" ADD COLUMN     "arquivoOrigemId" TEXT;

-- CreateTable
CREATE TABLE "ArquivoImportado" (
    "id" TEXT NOT NULL,
    "nomeOriginal" TEXT NOT NULL,
    "caminhoStorage" TEXT NOT NULL,
    "tamanhoBytes" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "enviadoPorId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArquivoImportado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportacaoPedido" (
    "id" TEXT NOT NULL,
    "arquivoId" TEXT NOT NULL,
    "estado" "EstadoImportacao" NOT NULL DEFAULT 'EXTRAINDO',
    "extracaoBruta" JSONB,
    "revisaoAtual" JSONB,
    "erro" TEXT,
    "fabricaId" TEXT,
    "clienteId" TEXT,
    "pedidoId" TEXT,
    "criadoPorId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportacaoPedido_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ArquivoImportado_caminhoStorage_key" ON "ArquivoImportado"("caminhoStorage");

-- CreateIndex
CREATE INDEX "ArquivoImportado_enviadoPorId_idx" ON "ArquivoImportado"("enviadoPorId");

-- CreateIndex
CREATE UNIQUE INDEX "ImportacaoPedido_pedidoId_key" ON "ImportacaoPedido"("pedidoId");

-- CreateIndex
CREATE INDEX "ImportacaoPedido_arquivoId_idx" ON "ImportacaoPedido"("arquivoId");

-- CreateIndex
CREATE INDEX "ImportacaoPedido_estado_idx" ON "ImportacaoPedido"("estado");

-- CreateIndex
CREATE INDEX "ImportacaoPedido_criadoPorId_idx" ON "ImportacaoPedido"("criadoPorId");

-- CreateIndex
CREATE INDEX "ItemFaturado_notaFiscalId_idx" ON "ItemFaturado"("notaFiscalId");

-- CreateIndex
CREATE UNIQUE INDEX "ItemFaturado_itemPedidoId_notaFiscalId_key" ON "ItemFaturado"("itemPedidoId", "notaFiscalId");

-- CreateIndex
CREATE INDEX "ItemPedido_pedidoId_idx" ON "ItemPedido"("pedidoId");

-- CreateIndex
CREATE INDEX "ItemPedido_referencia_idx" ON "ItemPedido"("referencia");

-- CreateIndex
CREATE INDEX "ItemPedido_status_idx" ON "ItemPedido"("status");

-- CreateIndex
CREATE INDEX "Pedido_fabricaId_idx" ON "Pedido"("fabricaId");

-- CreateIndex
CREATE INDEX "Pedido_clienteId_idx" ON "Pedido"("clienteId");

-- CreateIndex
CREATE INDEX "Pedido_estado_idx" ON "Pedido"("estado");

-- CreateIndex
CREATE INDEX "Pedido_criadoEm_idx" ON "Pedido"("criadoEm");

-- CreateIndex
CREATE INDEX "Pedido_arquivoOrigemId_idx" ON "Pedido"("arquivoOrigemId");

-- CreateIndex
CREATE UNIQUE INDEX "Pedido_fabricaId_clienteId_numero_key" ON "Pedido"("fabricaId", "clienteId", "numero");

-- AddForeignKey
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_arquivoOrigemId_fkey" FOREIGN KEY ("arquivoOrigemId") REFERENCES "ArquivoImportado"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArquivoImportado" ADD CONSTRAINT "ArquivoImportado_enviadoPorId_fkey" FOREIGN KEY ("enviadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportacaoPedido" ADD CONSTRAINT "ImportacaoPedido_arquivoId_fkey" FOREIGN KEY ("arquivoId") REFERENCES "ArquivoImportado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportacaoPedido" ADD CONSTRAINT "ImportacaoPedido_fabricaId_fkey" FOREIGN KEY ("fabricaId") REFERENCES "Fabrica"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportacaoPedido" ADD CONSTRAINT "ImportacaoPedido_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportacaoPedido" ADD CONSTRAINT "ImportacaoPedido_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Pedido"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportacaoPedido" ADD CONSTRAINT "ImportacaoPedido_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

