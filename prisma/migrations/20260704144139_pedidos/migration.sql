-- CreateEnum
CREATE TYPE "EstadoPedido" AS ENUM ('SEM_NFE', 'PARCIAL', 'COMPLETO', 'ARQUIVADO');

-- CreateEnum
CREATE TYPE "OrigemPedido" AS ENUM ('EXCEL', 'MANUAL');

-- CreateEnum
CREATE TYPE "StatusItemPedido" AS ENUM ('PENDENTE', 'OK', 'FORA_DE_FABRICACAO', 'DESISTENCIA');

-- CreateTable
CREATE TABLE "Pedido" (
    "id" TEXT NOT NULL,
    "numero" TEXT,
    "semNumero" BOOLEAN NOT NULL DEFAULT false,
    "origem" "OrigemPedido" NOT NULL,
    "estado" "EstadoPedido" NOT NULL DEFAULT 'SEM_NFE',
    "fabricaId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Pedido_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemPedido" (
    "id" TEXT NOT NULL,
    "pedidoId" TEXT NOT NULL,
    "referencia" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "quantidadePedida" INTEGER NOT NULL,
    "quantidadeFaturada" INTEGER NOT NULL DEFAULT 0,
    "valorUnitario" DECIMAL(12,2) NOT NULL,
    "status" "StatusItemPedido" NOT NULL DEFAULT 'PENDENTE',
    "observacao" TEXT,
    "qtdPendenteCongelada" INTEGER,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ItemPedido_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_fabricaId_fkey" FOREIGN KEY ("fabricaId") REFERENCES "Fabrica"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemPedido" ADD CONSTRAINT "ItemPedido_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Pedido"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
