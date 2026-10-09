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
import { BotaoAtualizarRastreio } from "../botao-atualizar";

export const maxDuration = 60;

const fmt = (d: Date | null, comHora = false) =>
  d
    ? d.toLocaleString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        ...(comHora ? { hour: "2-digit", minute: "2-digit" } : {}),
      })
    : "—";

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
    autor: evento.usuario?.nome ?? `${nota.transportadora?.nome ?? "Transportadora"} (automático)`,
    descricao: [evento.observacao, evento.local].filter(Boolean).join(" · ") || undefined,
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

      <div className="flex flex-col gap-3 rounded-lg border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <dl className="grid flex-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">Transportadora</dt>
              <dd>
                {nota.transportadora?.nome ?? "Não informada na nota"}
                {nota.transportadora?.metodo === "NAO_MAPEADA" && <span className="ml-2 text-xs text-warning">ainda sem rastreio automático</span>}
                {nota.transportadora?.metodo === "MANUAL" && <span className="ml-2 text-xs text-muted-foreground">rastreio manual{nota.transportadora.contato ? ` · ${nota.transportadora.contato}` : ""}</span>}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Previsão de entrega</dt>
              <dd>{fmt(nota.previsaoEntrega)}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs text-muted-foreground">Última ocorrência</dt>
              <dd>{nota.ultimaOcorrencia ? `${nota.ultimaOcorrencia} · ${fmt(nota.ultimaOcorrenciaEm, true)}` : "Nenhuma ainda"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Consultado em</dt>
              <dd>{fmt(nota.rastreioAtualizadoEm, true)}</dd>
            </div>
            {(nota.volumes || nota.pesoBruto) && (
              <div>
                <dt className="text-xs text-muted-foreground">Carga</dt>
                <dd>{[nota.volumes ? `${nota.volumes} vol.` : null, nota.pesoBruto ? `${Number(nota.pesoBruto).toLocaleString("pt-BR")} kg` : null].filter(Boolean).join(" · ")}</dd>
              </div>
            )}
          </dl>
          {nota.transportadora?.metodo !== "MANUAL" && (nota.status === "TRANSITO" || nota.status === "AGENDADO") && <BotaoAtualizarRastreio notaFiscalId={nota.id} />}
        </div>
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
