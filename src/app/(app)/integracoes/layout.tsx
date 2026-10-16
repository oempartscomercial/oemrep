import { PageContainer } from "@/components/layouts/page-container";
import { SessaoExpirada } from "@/components/patterns/sessao-expirada";
import { obterUsuarioLogado } from "@/lib/sessao";

// Integrações é só do ADMIN (ADR-019): o menu esconde e a rota barra; as actions também recusam.
export default async function IntegracoesLayout({ children }: { children: React.ReactNode }) {
  const usuario = await obterUsuarioLogado();
  return (
    <PageContainer>
      {!usuario ? <SessaoExpirada /> : usuario.perfil === "ADMIN" ? children : <p className="text-sm text-destructive">Acesso restrito a administradores.</p>}
    </PageContainer>
  );
}
