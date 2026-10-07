-- DropForeignKey
ALTER TABLE "ImportacaoPedido" DROP CONSTRAINT "ImportacaoPedido_arquivoId_fkey";

-- AlterTable
ALTER TABLE "ImportacaoPedido" ALTER COLUMN "arquivoId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "ImportacaoPedido" ADD CONSTRAINT "ImportacaoPedido_arquivoId_fkey" FOREIGN KEY ("arquivoId") REFERENCES "ArquivoImportado"("id") ON DELETE SET NULL ON UPDATE CASCADE;

