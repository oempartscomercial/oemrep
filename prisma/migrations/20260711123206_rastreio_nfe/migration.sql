-- CreateTable
CREATE TABLE "EventoRastreio" (
    "id" TEXT NOT NULL,
    "notaFiscalId" TEXT NOT NULL,
    "statusAnterior" "StatusRastreio" NOT NULL,
    "status" "StatusRastreio" NOT NULL,
    "observacao" TEXT,
    "dataEvento" TIMESTAMP(3) NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventoRastreio_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventoRastreio_notaFiscalId_idx" ON "EventoRastreio"("notaFiscalId");

-- AddForeignKey
ALTER TABLE "EventoRastreio" ADD CONSTRAINT "EventoRastreio_notaFiscalId_fkey" FOREIGN KEY ("notaFiscalId") REFERENCES "NotaFiscal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventoRastreio" ADD CONSTRAINT "EventoRastreio_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
