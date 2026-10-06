import { Download01 } from "@untitledui/icons";
import { obterUsuarioLogado } from "@/lib/sessao";
import { buscarNotasFiscaisPermitidas } from "./queries";
import { PageContainer } from "@/components/layouts/page-container";
import { PageHeader } from "@/components/patterns/page-header";
import { SessaoExpirada } from "@/components/patterns/sessao-expirada";
import { Button } from "@/components/ui/buttons/button";
import { RastreioTabela, type NotaRastreioLinha } from "./rastreio-tabela";

export default async function RastreioPage() {
  const usuario = await obterUsuarioLogado();
  if (!usuario) {
    return (
      <PageContainer>
        <SessaoExpirada />
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
      <PageHeader
        titulo="Rastreio de NFe"
        descricao="Acompanhe a situação logística das notas fiscais."
        acoes={<Button color="secondary" href="/api/export/rastreio" iconLeading={<Download01 />}>Exportar XLSX</Button>}
      />
      <RastreioTabela notas={linhas} />
    </PageContainer>
  );
}
