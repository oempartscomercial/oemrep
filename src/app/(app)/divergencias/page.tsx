import { Download01 } from "@untitledui/icons";
import { obterUsuarioLogado } from "@/lib/sessao";
import { buscarChamadosPermitidos } from "./queries";
import { PageContainer } from "@/components/layouts/page-container";
import { PageHeader } from "@/components/patterns/page-header";
import { Button } from "@/components/ui/buttons/button";
import { ChamadosTabela, type ChamadoLinha } from "./chamados-tabela";

export default async function DivergenciasPage() {
  const usuario = await obterUsuarioLogado();
  if (!usuario) {
    return (
      <PageContainer>
        <p className="text-sm text-error-primary">Sessão expirada. Faça login novamente.</p>
      </PageContainer>
    );
  }

  const chamados = await buscarChamadosPermitidos(usuario);
  const linhas: ChamadoLinha[] = chamados.map((chamado) => ({
    id: chamado.id,
    nfe: chamado.notaFiscal.numero,
    motivo: chamado.motivo.nome,
    estado: chamado.estado,
    critico: chamado.critico,
  }));

  return (
    <PageContainer>
      <PageHeader
        titulo="Divergências"
        descricao="Chamados abertos a partir de notas fiscais."
        acoes={
          <Button color="secondary" href="/api/export/divergencias" iconLeading={<Download01 />}>
            Exportar XLSX
          </Button>
        }
      />
      <ChamadosTabela chamados={linhas} />
    </PageContainer>
  );
}
