"use client";

import { DataTable } from "@/components/patterns/data-table";
import { StatusBadge } from "@/components/patterns/status-badge";
import { Badge } from "@/components/ui/badges/badges";

export interface ChamadoLinha {
  id: string;
  nfe: string;
  motivo: string;
  estado: string;
  critico: boolean;
  ultimaAtualizacao: string;
}

function tempoDesde(iso: string) {
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (dias <= 0) return "hoje";
  if (dias === 1) return "ontem";
  return `há ${dias} dias`;
}

export function ChamadosTabela({ chamados, vazio }: { chamados: ChamadoLinha[]; vazio: string }) {
  return (
    <DataTable<ChamadoLinha>
      ariaLabel="Chamados de divergência"
      data={chamados}
      getRowId={(c) => c.id}
      rowHref={(c) => `/divergencias/${c.id}`}
      vazio={vazio}
      columns={[
        { id: "nfe", header: "NFe", isRowHeader: true, render: (c) => <span className="font-medium text-primary">{c.nfe}</span> },
        { id: "motivo", header: "Motivo", render: (c) => c.motivo },
        {
          id: "estado",
          header: "Estado",
          render: (c) => (
            <div className="flex items-center gap-2">
              <StatusBadge tipo="chamado" valor={c.estado} />
              {c.critico && <Badge color="error" type="pill-color" size="sm">Crítico</Badge>}
            </div>
          ),
        },
        {
          id: "atualizacao",
          header: "Última atualização",
          render: (c) => (
            <span title={new Date(c.ultimaAtualizacao).toLocaleString("pt-BR")}>
              {new Date(c.ultimaAtualizacao).toLocaleDateString("pt-BR")}{" "}
              <span className="text-tertiary">({tempoDesde(c.ultimaAtualizacao)})</span>
            </span>
          ),
        },
      ]}
    />
  );
}
