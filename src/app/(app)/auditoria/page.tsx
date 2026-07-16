import { obterUsuarioLogado } from "@/lib/sessao";
import {
  buscarEventosAuditoria,
  listarUsuariosParaFiltro,
  listarEntidadesAuditadas,
  AUDITORIA_LIMITE,
} from "./queries";
import { PageContainer } from "@/components/layouts/page-container";
import { PageHeader } from "@/components/patterns/page-header";
import { AuditoriaFiltros } from "./auditoria-filtros";
import { AuditoriaTabela, type EventoAuditoriaLinha } from "./auditoria-tabela";

export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<{ de?: string; ate?: string; usuarioId?: string; entidade?: string }>;
}) {
  const { de, ate, usuarioId, entidade } = await searchParams;

  const usuario = await obterUsuarioLogado();
  if (!usuario) {
    return (
      <PageContainer>
        <p className="text-sm text-error-primary">Sessão expirada. Faça login novamente.</p>
      </PageContainer>
    );
  }

  const [eventos, usuarios, entidades] = await Promise.all([
    buscarEventosAuditoria({ de, ate, usuarioId, entidade }),
    listarUsuariosParaFiltro(),
    listarEntidadesAuditadas(),
  ]);

  const linhas: EventoAuditoriaLinha[] = eventos.map((e) => ({
    id: e.id,
    quando: new Date(e.criadoEm).toLocaleString("pt-BR"),
    usuario: e.usuario.nome,
    entidade: e.entidade,
    entidadeId: e.entidadeId,
    campo: e.campo,
    de: e.valorAnterior ?? "—",
    para: e.valorNovo ?? "—",
  }));

  return (
    <PageContainer>
      <PageHeader titulo="Auditoria" descricao="Histórico de alterações em pedidos e notas fiscais." />

      <AuditoriaFiltros
        usuarios={usuarios.map((u) => ({ id: u.id, label: u.nome }))}
        entidades={entidades.map((e) => ({ id: e, label: e }))}
        selecionado={{ de, ate, usuarioId, entidade }}
      />

      <AuditoriaTabela eventos={linhas} />

      {eventos.length === AUDITORIA_LIMITE && (
        <p className="text-xs text-quaternary">
          Mostrando os {AUDITORIA_LIMITE} eventos mais recentes. Refine o período ou os filtros para ver o restante.
        </p>
      )}
    </PageContainer>
  );
}
