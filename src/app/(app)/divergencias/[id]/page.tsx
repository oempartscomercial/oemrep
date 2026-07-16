import { notFound } from "next/navigation";
import { obterUsuarioLogado } from "@/lib/sessao";
import { buscarChamadoComPermissao } from "../queries";
import { proximosEstadosChamado, type EstadoChamado } from "@/domain/chamado/estado";
import { PageContainer } from "@/components/layouts/page-container";
import { StatusBadge } from "@/components/patterns/status-badge";
import { statusBadgeConfig } from "@/components/patterns/status-badge.config";
import { Timeline, type TimelineItem } from "@/components/patterns/timeline";
import { ChamadoEventoForm } from "./chamado-evento-form";

export default async function DetalheChamadoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const usuario = await obterUsuarioLogado();
  if (!usuario) notFound();

  const chamado = await buscarChamadoComPermissao(id, usuario);
  if (!chamado) notFound();

  const proximos = proximosEstadosChamado(chamado.estado as EstadoChamado);

  const timeline: TimelineItem[] = chamado.eventos.map((evento) => ({
    id: evento.id,
    titulo: evento.estadoAnterior
      ? `${statusBadgeConfig("chamado", evento.estadoAnterior).label} → ${statusBadgeConfig("chamado", evento.estado).label}`
      : `Aberto (${statusBadgeConfig("chamado", evento.estado).label})`,
    data: new Date(evento.criadoEm).toLocaleString("pt-BR"),
    autor: evento.usuario.nome,
    descricao: evento.observacao || undefined,
  }));

  return (
    <PageContainer>
      <div className="flex flex-col gap-4 border-b border-secondary pb-5 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-display-xs font-semibold text-primary">Chamado — NFe {chamado.notaFiscal.numero}</h1>
            <StatusBadge tipo="chamado" valor={chamado.estado} size="md" />
          </div>
          <p className="text-sm text-tertiary">{chamado.motivo.nome}</p>
        </div>
      </div>

      <div className="rounded-xl bg-primary p-6 ring-1 ring-secondary">
        <h2 className="text-lg font-semibold text-primary">Itens afetados</h2>
        <ul className="mt-3 flex flex-col gap-1 text-sm text-secondary">
          {chamado.itensAfetados.map(({ itemPedido }) => (
            <li key={itemPedido.id}>
              <span className="font-medium text-primary">{itemPedido.referencia}</span> — {itemPedido.descricao}
            </li>
          ))}
        </ul>
      </div>

      {proximos.length > 0 ? (
        <ChamadoEventoForm chamadoId={chamado.id} proximos={proximos} />
      ) : (
        <p className="text-sm text-tertiary">Chamado resolvido. Não há próximas transições.</p>
      )}

      <div className="flex flex-col gap-4 rounded-xl bg-primary p-6 ring-1 ring-secondary">
        <h2 className="text-lg font-semibold text-primary">Histórico</h2>
        {timeline.length === 0 ? (
          <p className="text-sm text-tertiary">Nenhum evento ainda.</p>
        ) : (
          <Timeline eventos={timeline} />
        )}
      </div>
    </PageContainer>
  );
}
