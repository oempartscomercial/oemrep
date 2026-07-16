import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obterUsuarioLogado } from "@/lib/sessao";
import { buscarNotaFiscalComPermissao } from "../queries";
import { proximosStatusRastreio, type StatusRastreio } from "@/domain/nfe/rastreio";
import { PageContainer } from "@/components/layouts/page-container";
import { StatusBadge } from "@/components/patterns/status-badge";
import { statusBadgeConfig } from "@/components/patterns/status-badge.config";
import { Timeline, type TimelineItem } from "@/components/patterns/timeline";
import { RastreioForm } from "./rastreio-form";

export default async function DetalheRastreioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const usuario = await obterUsuarioLogado();
  if (!usuario) notFound();

  const nota = await buscarNotaFiscalComPermissao(id, usuario);
  if (!nota) notFound();

  const eventos = await prisma.eventoRastreio.findMany({
    where: { notaFiscalId: nota.id },
    orderBy: { dataEvento: "desc" },
    include: { usuario: true },
  });

  const proximos = proximosStatusRastreio(nota.status as StatusRastreio);

  const timeline: TimelineItem[] = eventos.map((evento) => ({
    id: evento.id,
    titulo: `${statusBadgeConfig("nfe", evento.statusAnterior ?? "").label} → ${statusBadgeConfig("nfe", evento.status).label}`,
    data: new Date(evento.dataEvento).toLocaleDateString("pt-BR"),
    autor: evento.usuario.nome,
    descricao: evento.observacao || undefined,
    destaque: evento.status === "EXTRAVIADO",
  }));

  return (
    <PageContainer>
      <div className="flex flex-col gap-4 border-b border-secondary pb-5 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <h1 className="text-display-xs font-semibold text-primary">NFe {nota.numero}</h1>
            <StatusBadge tipo="nfe" valor={nota.status} size="md" />
          </div>
          <p className="text-sm text-tertiary">{nota.chaveAcesso}</p>
        </div>
      </div>

      {proximos.length > 0 ? (
        <RastreioForm notaFiscalId={nota.id} proximos={proximos} />
      ) : (
        <p className="text-sm text-tertiary">Rastreio finalizado ({statusBadgeConfig("nfe", nota.status).label}). Não há próximas transições.</p>
      )}

      <div className="flex flex-col gap-4 rounded-xl bg-primary p-6 ring-1 ring-secondary">
        <h2 className="text-lg font-semibold text-primary">Histórico</h2>
        {timeline.length === 0 ? (
          <p className="text-sm text-tertiary">Nenhum evento de rastreio ainda.</p>
        ) : (
          <Timeline eventos={timeline} />
        )}
      </div>
    </PageContainer>
  );
}
