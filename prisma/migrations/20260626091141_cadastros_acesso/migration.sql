-- CreateEnum
CREATE TYPE "PerfilUsuario" AS ENUM ('OPERADOR', 'ANALISTA', 'ADMIN');

-- CreateEnum
CREATE TYPE "TipoConfirmacaoEstoque" AS ENUM ('AUTOMATICA', 'PRESUMIDA');

-- CreateTable
CREATE TABLE "Fabrica" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cnpj" TEXT NOT NULL,
    "flagConciliacao" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Fabrica_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cliente" (
    "id" TEXT NOT NULL,
    "cnpj" TEXT NOT NULL,
    "nomeFantasia" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClienteFabrica" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "fabricaId" TEXT NOT NULL,
    "flagAcessoSistema" BOOLEAN NOT NULL DEFAULT false,
    "tipoConfirmacaoEstoque" "TipoConfirmacaoEstoque" NOT NULL DEFAULT 'PRESUMIDA',

    CONSTRAINT "ClienteFabrica_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "supabaseUserId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "perfil" "PerfilUsuario" NOT NULL DEFAULT 'OPERADOR',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsuarioFabrica" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "fabricaId" TEXT NOT NULL,

    CONSTRAINT "UsuarioFabrica_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventoAuditoria" (
    "id" TEXT NOT NULL,
    "entidade" TEXT NOT NULL,
    "entidadeId" TEXT NOT NULL,
    "campo" TEXT NOT NULL,
    "valorAnterior" TEXT,
    "valorNovo" TEXT,
    "usuarioId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventoAuditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Fabrica_cnpj_key" ON "Fabrica"("cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "Cliente_cnpj_key" ON "Cliente"("cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "ClienteFabrica_clienteId_fabricaId_key" ON "ClienteFabrica"("clienteId", "fabricaId");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_supabaseUserId_key" ON "Usuario"("supabaseUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "UsuarioFabrica_usuarioId_fabricaId_key" ON "UsuarioFabrica"("usuarioId", "fabricaId");

-- CreateIndex
CREATE INDEX "EventoAuditoria_entidade_entidadeId_idx" ON "EventoAuditoria"("entidade", "entidadeId");

-- AddForeignKey
ALTER TABLE "ClienteFabrica" ADD CONSTRAINT "ClienteFabrica_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClienteFabrica" ADD CONSTRAINT "ClienteFabrica_fabricaId_fkey" FOREIGN KEY ("fabricaId") REFERENCES "Fabrica"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsuarioFabrica" ADD CONSTRAINT "UsuarioFabrica_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsuarioFabrica" ADD CONSTRAINT "UsuarioFabrica_fabricaId_fkey" FOREIGN KEY ("fabricaId") REFERENCES "Fabrica"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventoAuditoria" ADD CONSTRAINT "EventoAuditoria_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
