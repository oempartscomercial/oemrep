-- Envio manual assistido: sem o envio automático, a pessoa envia pelo celular de prospecção e
-- confirma na plataforma ("Já enviei"). Fica registrado que foi à mão e quem confirmou.

-- AlterTable
ALTER TABLE "Mensagem" ADD COLUMN     "enviadaPorId" TEXT,
ADD COLUMN     "envioManual" BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE "Mensagem" ADD CONSTRAINT "Mensagem_enviadaPorId_fkey" FOREIGN KEY ("enviadaPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
