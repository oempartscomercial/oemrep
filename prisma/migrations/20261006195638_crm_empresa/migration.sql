-- CreateEnum
CREATE TYPE "SituacaoEmpresa" AS ENUM ('CANDIDATA', 'APROVADA', 'EM_CONTATO', 'CONVERSANDO', 'AVANCO', 'PAUSADA', 'DESCARTADA', 'CLIENTE');

-- CreateEnum
CREATE TYPE "CanalContato" AS ENUM ('WHATSAPP', 'TELEFONE', 'EMAIL', 'LINKEDIN', 'OUTRO');

-- CreateEnum
CREATE TYPE "CanalInteracao" AS ENUM ('WHATSAPP', 'TELEFONE', 'EMAIL', 'VISITA', 'REUNIAO', 'PESQUISA', 'OUTRO');

-- CreateEnum
CREATE TYPE "OrigemInteracao" AS ENUM ('USUARIO', 'AUTOMACAO', 'IMPORTACAO');

-- CreateEnum
CREATE TYPE "TipoPedidoHistorico" AS ENUM ('PEDIDO', 'BONIFICACAO');

-- AlterTable
ALTER TABLE "Cliente" ADD COLUMN     "cidade" TEXT,
ADD COLUMN     "grupo" TEXT,
ADD COLUMN     "naoContatar" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "observacoes" TEXT,
ADD COLUMN     "origem" TEXT,
ADD COLUMN     "site" TEXT,
ADD COLUMN     "situacao" "SituacaoEmpresa" NOT NULL DEFAULT 'CLIENTE',
ADD COLUMN     "uf" TEXT,
ALTER COLUMN "cnpj" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Contato" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "nome" TEXT,
    "funcao" TEXT,
    "canal" "CanalContato" NOT NULL,
    "valor" TEXT NOT NULL,
    "servePara" TEXT,
    "status" TEXT,
    "fonte" TEXT NOT NULL,
    "verificadoEm" TIMESTAMP(3),
    "naoContatar" BOOLEAN NOT NULL DEFAULT false,
    "observacoes" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Contato_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Interacao" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "canal" "CanalInteracao" NOT NULL,
    "comQuem" TEXT,
    "resumo" TEXT NOT NULL,
    "resultado" TEXT,
    "origem" "OrigemInteracao" NOT NULL DEFAULT 'USUARIO',
    "usuarioId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Interacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProximoPasso" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "acao" TEXT NOT NULL,
    "prazo" DATE NOT NULL,
    "responsavelId" TEXT NOT NULL,
    "concluidoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProximoPasso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PedidoHistorico" (
    "id" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "dataSoMes" BOOLEAN NOT NULL DEFAULT false,
    "clienteId" TEXT NOT NULL,
    "fabricaId" TEXT NOT NULL,
    "valor" DECIMAL(14,2) NOT NULL,
    "tipo" "TipoPedidoHistorico" NOT NULL DEFAULT 'PEDIDO',
    "rotuloPlanilha" TEXT NOT NULL,
    "linhaPlanilha" INTEGER NOT NULL,
    "suspeitaDuplicidade" BOOLEAN NOT NULL DEFAULT false,
    "alerta" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PedidoHistorico_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Contato_clienteId_idx" ON "Contato"("clienteId");

-- CreateIndex
CREATE INDEX "Interacao_clienteId_data_idx" ON "Interacao"("clienteId", "data");

-- CreateIndex
CREATE INDEX "ProximoPasso_clienteId_concluidoEm_idx" ON "ProximoPasso"("clienteId", "concluidoEm");

-- CreateIndex
CREATE INDEX "ProximoPasso_responsavelId_prazo_idx" ON "ProximoPasso"("responsavelId", "prazo");

-- CreateIndex
CREATE UNIQUE INDEX "PedidoHistorico_linhaPlanilha_key" ON "PedidoHistorico"("linhaPlanilha");

-- CreateIndex
CREATE INDEX "PedidoHistorico_clienteId_data_idx" ON "PedidoHistorico"("clienteId", "data");

-- AddForeignKey
ALTER TABLE "Contato" ADD CONSTRAINT "Contato_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interacao" ADD CONSTRAINT "Interacao_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interacao" ADD CONSTRAINT "Interacao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProximoPasso" ADD CONSTRAINT "ProximoPasso_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProximoPasso" ADD CONSTRAINT "ProximoPasso_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoHistorico" ADD CONSTRAINT "PedidoHistorico_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoHistorico" ADD CONSTRAINT "PedidoHistorico_fabricaId_fkey" FOREIGN KEY ("fabricaId") REFERENCES "Fabrica"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
