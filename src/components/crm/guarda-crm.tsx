import type { ReactNode } from "react";
import { PageContainer } from "@/components/layouts/page-container";
import { SessaoExpirada } from "@/components/patterns/sessao-expirada";
import { obterUsuarioLogado } from "@/lib/sessao";
import { podeVerCrm } from "@/lib/authz";

/** CRM é de ADMIN e ANALISTA (ADR-013 §6): o menu esconde e a rota barra. */
export async function GuardaCrm({ children }: { children: ReactNode }) {
  const usuario = await obterUsuarioLogado();
  if (!usuario) {
    return (
      <PageContainer>
        <SessaoExpirada />
      </PageContainer>
    );
  }
  if (!podeVerCrm(usuario)) {
    return (
      <PageContainer>
        <p className="text-sm text-destructive">Acesso restrito a administradores e analistas.</p>
      </PageContainer>
    );
  }
  return children;
}
