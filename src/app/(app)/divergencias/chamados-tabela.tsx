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
}

export function ChamadosTabela({ chamados }: { chamados: ChamadoLinha[] }) {
  return (
    <DataTable<ChamadoLinha>
      ariaLabel="Chamados de divergência"
      data={chamados}
      getRowId={(c) => c.id}
      rowHref={(c) => `/divergencias/${c.id}`}
      vazio="Nenhum chamado aberto ainda."
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
      ]}
    />
  );
}
