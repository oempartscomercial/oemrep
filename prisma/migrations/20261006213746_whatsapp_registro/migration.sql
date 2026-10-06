-- CreateEnum
CREATE TYPE "LinhaWhatsapp" AS ENUM ('PROSPECCAO', 'ASSISTENTE');

-- CreateEnum
CREATE TYPE "DirecaoMensagem" AS ENUM ('ENTRADA', 'SAIDA');

-- CreateEnum
CREATE TYPE "OrigemMensagem" AS ENUM ('CONTATO', 'ROMULO_NO_CELULAR', 'PLATAFORMA', 'ASSISTENTE');

-- CreateEnum
CREATE TYPE "TipoMensagem" AS ENUM ('TEXTO', 'AUDIO', 'IMAGEM', 'VIDEO', 'DOCUMENTO', 'OUTRO');

-- CreateTable
CREATE TABLE "EventoWhatsapp" (
    "id" TEXT NOT NULL,
    "linha" "LinhaWhatsapp" NOT NULL,
    "payload" JSONB NOT NULL,
    "recebidoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processadoEm" TIMESTAMP(3),
    "resultado" TEXT,

    CONSTRAINT "EventoWhatsapp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversa" (
    "id" TEXT NOT NULL,
    "linha" "LinhaWhatsapp" NOT NULL,
    "numero" TEXT NOT NULL,
    "clienteId" TEXT,
    "contatoId" TEXT,
    "motivoSemVinculo" TEXT,
    "nomeNoWhatsapp" TEXT,
    "ultimaMensagemEm" TIMESTAMP(3) NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Conversa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mensagem" (
    "id" TEXT NOT NULL,
    "conversaId" TEXT NOT NULL,
    "linha" "LinhaWhatsapp" NOT NULL,
    "idExterno" TEXT NOT NULL,
    "direcao" "DirecaoMensagem" NOT NULL,
    "origem" "OrigemMensagem" NOT NULL,
    "tipo" "TipoMensagem" NOT NULL,
    "texto" TEXT,
    "ocorridoEm" TIMESTAMP(3) NOT NULL,
    "eventoId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Mensagem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventoWhatsapp_linha_recebidoEm_idx" ON "EventoWhatsapp"("linha", "recebidoEm");

-- CreateIndex
CREATE INDEX "Conversa_clienteId_idx" ON "Conversa"("clienteId");

-- CreateIndex
CREATE INDEX "Conversa_ultimaMensagemEm_idx" ON "Conversa"("ultimaMensagemEm");

-- CreateIndex
CREATE UNIQUE INDEX "Conversa_linha_numero_key" ON "Conversa"("linha", "numero");

-- CreateIndex
CREATE INDEX "Mensagem_conversaId_ocorridoEm_idx" ON "Mensagem"("conversaId", "ocorridoEm");

-- CreateIndex
CREATE UNIQUE INDEX "Mensagem_linha_idExterno_key" ON "Mensagem"("linha", "idExterno");

-- AddForeignKey
ALTER TABLE "Conversa" ADD CONSTRAINT "Conversa_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversa" ADD CONSTRAINT "Conversa_contatoId_fkey" FOREIGN KEY ("contatoId") REFERENCES "Contato"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mensagem" ADD CONSTRAINT "Mensagem_conversaId_fkey" FOREIGN KEY ("conversaId") REFERENCES "Conversa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mensagem" ADD CONSTRAINT "Mensagem_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "EventoWhatsapp"("id") ON DELETE SET NULL ON UPDATE CASCADE;
