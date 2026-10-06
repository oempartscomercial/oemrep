"use client";

import { PageContainer } from "@/components/layouts/page-container";
import { Botao } from "@/components/patterns/botao";

// Erro inesperado numa tela: nada de mensagem técnica. O código serve para achar o
// erro nos logs da Vercel quando alguém reportar.
export default function ErroNaTela({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <PageContainer>
      <div className="flex flex-col items-start gap-3">
        <h1 className="text-lg font-semibold tracking-tight">Algo deu errado nesta tela</h1>
        <p className="text-sm text-muted-foreground">
          Nada foi perdido. Tente de novo; se continuar, avise o administrador
          {error.digest ? <> e informe o código <span className="font-mono text-foreground/80">{error.digest}</span></> : null}.
        </p>
        <div className="flex gap-2">
          <Botao variante="primario" type="button" onClick={reset}>Tentar de novo</Botao>
          <Botao href="/">Voltar para o início</Botao>
        </div>
      </div>
    </PageContainer>
  );
}
