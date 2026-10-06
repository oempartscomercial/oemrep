import { PageContainer } from "@/components/layouts/page-container";
import { obterUsuarioLogado } from "@/lib/sessao";
import { CadastrosNav } from "./cadastros-nav";

// Cadastros é só do ADMIN (PRD §4); as actions também recusam os outros perfis.
export default async function CadastrosLayout({ children }: { children: React.ReactNode }) {
  const usuario = await obterUsuarioLogado();
  return (
    <PageContainer>
      {usuario?.perfil === "ADMIN" ? (
        <>
          <CadastrosNav />
          {children}
        </>
      ) : (
        <p className="text-sm text-error-primary">Acesso restrito a administradores.</p>
      )}
    </PageContainer>
  );
}
