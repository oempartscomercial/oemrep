-- CreateEnum
CREATE TYPE "StatusRastreio" AS ENUM ('TRANSITO', 'RECEBIDA', 'ARMAZENADA', 'EXTRAVIADO');

-- CreateTable
CREATE TABLE "NotaFiscal" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "chaveAcesso" TEXT NOT NULL,
    "emitenteCnpj" TEXT NOT NULL,
    "destinatarioCnpj" TEXT NOT NULL,
    "dataEmissao" TIMESTAMP(3) NOT NULL,
    "totalProdutos" DECIMAL(12,2) NOT NULL,
    "totalNota" DECIMAL(12,2) NOT NULL,
    "status" "StatusRastreio" NOT NULL DEFAULT 'TRANSITO',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotaFiscal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotaFiscalPedido" (
    "id" TEXT NOT NULL,
    "notaFiscalId" TEXT NOT NULL,
    "pedidoId" TEXT NOT NULL,

    CONSTRAINT "NotaFiscalPedido_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemFaturado" (
    "id" TEXT NOT NULL,
    "itemPedidoId" TEXT NOT NULL,
    "notaFiscalId" TEXT NOT NULL,
    "quantidadeFaturada" INTEGER NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ItemFaturado_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NotaFiscal_chaveAcesso_key" ON "NotaFiscal"("chaveAcesso");

-- CreateIndex
CREATE UNIQUE INDEX "NotaFiscalPedido_notaFiscalId_pedidoId_key" ON "NotaFiscalPedido"("notaFiscalId", "pedidoId");

-- AddForeignKey
ALTER TABLE "NotaFiscalPedido" ADD CONSTRAINT "NotaFiscalPedido_notaFiscalId_fkey" FOREIGN KEY ("notaFiscalId") REFERENCES "NotaFiscal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotaFiscalPedido" ADD CONSTRAINT "NotaFiscalPedido_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Pedido"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemFaturado" ADD CONSTRAINT "ItemFaturado_itemPedidoId_fkey" FOREIGN KEY ("itemPedidoId") REFERENCES "ItemPedido"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemFaturado" ADD CONSTRAINT "ItemFaturado_notaFiscalId_fkey" FOREIGN KEY ("notaFiscalId") REFERENCES "NotaFiscal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
