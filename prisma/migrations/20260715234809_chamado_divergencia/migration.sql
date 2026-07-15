-- CreateEnum
CREATE TYPE "EstadoChamado" AS ENUM ('ABERTO', 'EM_TRATATIVA', 'AGUARDANDO', 'RESOLVIDO');

-- CreateTable
CREATE TABLE "MotivoChamado" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,

    CONSTRAINT "MotivoChamado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Chamado" (
    "id" TEXT NOT NULL,
    "notaFiscalId" TEXT NOT NULL,
    "motivoId" TEXT NOT NULL,
    "estado" "EstadoChamado" NOT NULL DEFAULT 'ABERTO',
    "abertoPorId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Chamado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChamadoItem" (
    "id" TEXT NOT NULL,
    "chamadoId" TEXT NOT NULL,
    "itemPedidoId" TEXT NOT NULL,

    CONSTRAINT "ChamadoItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventoChamado" (
    "id" TEXT NOT NULL,
    "chamadoId" TEXT NOT NULL,
    "estadoAnterior" "EstadoChamado",
    "estado" "EstadoChamado" NOT NULL,
    "observacao" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventoChamado_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MotivoChamado_nome_key" ON "MotivoChamado"("nome");

-- CreateIndex
CREATE INDEX "Chamado_notaFiscalId_idx" ON "Chamado"("notaFiscalId");

-- CreateIndex
CREATE UNIQUE INDEX "ChamadoItem_chamadoId_itemPedidoId_key" ON "ChamadoItem"("chamadoId", "itemPedidoId");

-- CreateIndex
CREATE INDEX "EventoChamado_chamadoId_idx" ON "EventoChamado"("chamadoId");

-- AddForeignKey
ALTER TABLE "Chamado" ADD CONSTRAINT "Chamado_notaFiscalId_fkey" FOREIGN KEY ("notaFiscalId") REFERENCES "NotaFiscal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chamado" ADD CONSTRAINT "Chamado_motivoId_fkey" FOREIGN KEY ("motivoId") REFERENCES "MotivoChamado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chamado" ADD CONSTRAINT "Chamado_abertoPorId_fkey" FOREIGN KEY ("abertoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChamadoItem" ADD CONSTRAINT "ChamadoItem_chamadoId_fkey" FOREIGN KEY ("chamadoId") REFERENCES "Chamado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChamadoItem" ADD CONSTRAINT "ChamadoItem_itemPedidoId_fkey" FOREIGN KEY ("itemPedidoId") REFERENCES "ItemPedido"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventoChamado" ADD CONSTRAINT "EventoChamado_chamadoId_fkey" FOREIGN KEY ("chamadoId") REFERENCES "Chamado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventoChamado" ADD CONSTRAINT "EventoChamado_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
