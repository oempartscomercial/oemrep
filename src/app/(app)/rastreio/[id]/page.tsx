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
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-lg font-semibold tracking-tight">NFe {nota.numero}</h1>
          <StatusBadge tipo="nfe" valor={nota.status} />
        </div>
        <p className="text-sm text-muted-foreground">{nota.chaveAcesso}</p>
      </div>

      {proximos.length > 0 ? (
        <RastreioForm notaFiscalId={nota.id} proximos={proximos} />
      ) : (
        <p className="text-sm text-muted-foreground">Rastreio finalizado ({statusBadgeConfig("nfe", nota.status).label}). Não há próximas transições.</p>
      )}

      <div className="flex flex-col gap-4 rounded-lg border bg-card p-4">
        <h2 className="text-sm font-semibold">Histórico</h2>
        {timeline.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum evento de rastreio ainda.</p>
        ) : (
          <Timeline eventos={timeline} />
        )}
      </div>
    </PageContainer>
  );
}
