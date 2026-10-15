-- CreateEnum
CREATE TYPE "OrigemTokenApi" AS ENUM ('MANUAL', 'OAUTH');

-- AlterTable
ALTER TABLE "TokenApi" ADD COLUMN     "clienteOAuthId" TEXT,
ADD COLUMN     "expiraEm" TIMESTAMP(3),
ADD COLUMN     "origem" "OrigemTokenApi" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "refreshExpiraEm" TIMESTAMP(3),
ADD COLUMN     "refreshHash" TEXT;

-- CreateTable
CREATE TABLE "ClienteOAuth" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "redirectUris" TEXT[],
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClienteOAuth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CodigoOAuth" (
    "id" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "clienteOAuthId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "redirectUri" TEXT NOT NULL,
    "codeChallenge" TEXT NOT NULL,
    "recurso" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "usadoEm" TIMESTAMP(3),
    "tokenApiId" TEXT,

    CONSTRAINT "CodigoOAuth_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CodigoOAuth_hash_key" ON "CodigoOAuth"("hash");

-- CreateIndex
CREATE INDEX "CodigoOAuth_expiraEm_idx" ON "CodigoOAuth"("expiraEm");

-- CreateIndex
CREATE UNIQUE INDEX "TokenApi_refreshHash_key" ON "TokenApi"("refreshHash");

-- AddForeignKey
ALTER TABLE "TokenApi" ADD CONSTRAINT "TokenApi_clienteOAuthId_fkey" FOREIGN KEY ("clienteOAuthId") REFERENCES "ClienteOAuth"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodigoOAuth" ADD CONSTRAINT "CodigoOAuth_clienteOAuthId_fkey" FOREIGN KEY ("clienteOAuthId") REFERENCES "ClienteOAuth"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodigoOAuth" ADD CONSTRAINT "CodigoOAuth_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodigoOAuth" ADD CONSTRAINT "CodigoOAuth_tokenApiId_fkey" FOREIGN KEY ("tokenApiId") REFERENCES "TokenApi"("id") ON DELETE SET NULL ON UPDATE CASCADE;

