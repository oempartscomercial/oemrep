import { PageContainer } from "@/components/layouts/page-container";
import { obterUsuarioLogado } from "@/lib/sessao";

// Auditoria é de quem monitora (ADMIN e ANALISTA, PRD §4): o menu esconde e a rota barra.
export default async function AuditoriaLayout({ children }: { children: React.ReactNode }) {
  const usuario = await obterUsuarioLogado();
  if (usuario && usuario.perfil === "OPERADOR") {
    return (
      <PageContainer>
        <p className="text-sm text-destructive">Acesso restrito a administradores e analistas.</p>
      </PageContainer>
    );
  }
  return children;
}
