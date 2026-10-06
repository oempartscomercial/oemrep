"use client";

import { PageContainer } from "@/components/layouts/page-container";
import { Button } from "@/components/ui/buttons/button";

// Erro inesperado numa tela: nada de mensagem técnica. O código serve para achar o
// erro nos logs da Vercel quando alguém reportar.
export default function ErroNaTela({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <PageContainer>
      <div className="flex flex-col items-start gap-4">
        <h1 className="text-lg font-semibold text-primary">Algo deu errado nesta tela</h1>
        <p className="text-sm text-tertiary">
          Nada foi perdido. Tente de novo; se continuar, avise o administrador
          {error.digest ? <> e informe o código <span className="font-mono text-secondary">{error.digest}</span></> : null}.
        </p>
        <div className="flex gap-3">
          <Button color="primary" onClick={reset}>Tentar de novo</Button>
          <Button color="secondary" href="/">Voltar para o início</Button>
        </div>
      </div>
    </PageContainer>
  );
}
