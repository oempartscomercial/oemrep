import { obterUsuarioLogado } from "@/lib/sessao";
import { buscarNotasFiscaisPermitidas } from "./queries";
import { PageContainer } from "@/components/layouts/page-container";
import { PageHeader } from "@/components/patterns/page-header";
import { RastreioTabela, type NotaRastreioLinha } from "./rastreio-tabela";

export default async function RastreioPage() {
  const usuario = await obterUsuarioLogado();
  if (!usuario) {
    return (
      <PageContainer>
        <p className="text-sm text-error-primary">Sessão expirada. Faça login novamente.</p>
      </PageContainer>
    );
  }

  const notas = await buscarNotasFiscaisPermitidas(usuario);
  const linhas: NotaRastreioLinha[] = notas.map((nota) => ({
    id: nota.id,
    numero: nota.numero,
    chaveAcesso: nota.chaveAcesso,
    status: nota.status,
  }));

  return (
    <PageContainer>
      <PageHeader titulo="Rastreio de NFe" descricao="Acompanhe a situação logística das notas fiscais." />
      <RastreioTabela notas={linhas} />
    </PageContainer>
  );
}
