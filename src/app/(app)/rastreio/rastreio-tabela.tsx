"use client";

import { DataTable } from "@/components/patterns/data-table";
import { StatusBadge } from "@/components/patterns/status-badge";
import { cn } from "@/lib/utils";

export interface NotaRastreioLinha {
  id: string;
  numero: string;
  cliente: string;
  pedidos: string;
  transportadora: string | null;
  semRastreioAutomatico: boolean;
  status: string;
  previsao: string | null;
  ultimaOcorrencia: string | null;
  ultimaOcorrenciaEm: string | null;
  atualizado: string | null;
  parada: boolean;
}

export function RastreioTabela({ notas }: { notas: NotaRastreioLinha[] }) {
  return (
    <DataTable<NotaRastreioLinha>
      ariaLabel="Notas fiscais em rastreio"
      data={notas}
      getRowId={(n) => n.id}
      rowHref={(n) => `/rastreio/${n.id}`}
      vazio="Nenhuma nota nesta situação."
      columns={[
        {
          id: "numero",
          header: "NFe",
          isRowHeader: true,
          render: (n) => (
            <div className="flex flex-col">
              <span className="font-medium">{n.numero}</span>
              {n.pedidos && <span className="text-xs text-muted-foreground">ped. {n.pedidos}</span>}
            </div>
          ),
        },
        { id: "cliente", header: "Cliente", render: (n) => n.cliente },
        {
          id: "transportadora",
          header: "Transportadora",
          classe: "hidden md:table-cell",
          render: (n) =>
            n.transportadora ? (
              <div className="flex flex-col">
                <span>{n.transportadora}</span>
                {n.semRastreioAutomatico && <span className="text-xs text-warning">sem rastreio automático</span>}
              </div>
            ) : (
              <span className="text-muted-foreground">—</span>
            ),
        },
        {
          id: "status",
          header: "Status",
          render: (n) => (
            <div className="flex flex-col items-start gap-0.5">
              <StatusBadge tipo="nfe" valor={n.status} />
              {n.parada && <span className="text-xs font-medium text-warning">parada</span>}
            </div>
          ),
        },
        { id: "previsao", header: "Previsão", classe: "hidden sm:table-cell", render: (n) => n.previsao ?? <span className="text-muted-foreground">—</span> },
        {
          id: "ocorrencia",
          header: "Última ocorrência",
          classe: "hidden lg:table-cell",
          render: (n) =>
            n.ultimaOcorrencia ? (
              <div className={cn("flex max-w-72 flex-col", n.parada && "text-warning")}>
                <span className="truncate" title={n.ultimaOcorrencia}>{n.ultimaOcorrencia}</span>
                {n.ultimaOcorrenciaEm && <span className="text-xs text-muted-foreground">{n.ultimaOcorrenciaEm}</span>}
              </div>
            ) : (
              <span className="text-muted-foreground">—</span>
            ),
        },
        { id: "atualizado", header: "Consultado", classe: "hidden xl:table-cell", render: (n) => n.atualizado ?? <span className="text-muted-foreground">nunca</span> },
      ]}
    />
  );
}
