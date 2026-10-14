-- AlterEnum
ALTER TYPE "OrigemInteracao" ADD VALUE 'CLAUDE';

-- CreateTable
CREATE TABLE "TokenApi" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "prefixo" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimoUsoEm" TIMESTAMP(3),
    "revogadoEm" TIMESTAMP(3),

    CONSTRAINT "TokenApi_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TokenApi_hash_key" ON "TokenApi"("hash");

-- CreateIndex
CREATE INDEX "TokenApi_usuarioId_idx" ON "TokenApi"("usuarioId");

-- AddForeignKey
ALTER TABLE "TokenApi" ADD CONSTRAINT "TokenApi_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

