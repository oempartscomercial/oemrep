import { obterUsuarioLogado } from "@/lib/sessao";
import { PageContainer } from "@/components/layouts/page-container";
import { PageHeader } from "@/components/patterns/page-header";
import { ImportarHistoricoForm } from "./importar-form";

export default async function ImportarHistoricoPage() {
  const usuario = await obterUsuarioLogado();

  if (!usuario || usuario.perfil !== "ADMIN") {
    return (
      <PageContainer>
        <p className="text-sm text-error-primary">Acesso restrito a administradores.</p>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader titulo="Importar histórico" descricao="Envie as planilhas de controle (pedidos recebidos e NFes emitidas) para alimentar o gráfico histórico do dashboard." />
      <ImportarHistoricoForm />
    </PageContainer>
  );
}
