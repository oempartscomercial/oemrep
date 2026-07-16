"use client";

import { DataTable } from "@/components/patterns/data-table";
import { StatusBadge } from "@/components/patterns/status-badge";

export interface NotaRastreioLinha {
  id: string;
  numero: string;
  chaveAcesso: string;
  status: string;
}

export function RastreioTabela({ notas }: { notas: NotaRastreioLinha[] }) {
  return (
    <DataTable<NotaRastreioLinha>
      ariaLabel="Notas fiscais em rastreio"
      data={notas}
      getRowId={(n) => n.id}
      rowHref={(n) => `/rastreio/${n.id}`}
      vazio="Nenhuma NFe importada ainda."
      columns={[
        { id: "numero", header: "Número", isRowHeader: true, render: (n) => <span className="font-medium text-primary">{n.numero}</span> },
        { id: "chave", header: "Chave de acesso", render: (n) => <span className="text-xs text-tertiary">{n.chaveAcesso}</span> },
        { id: "status", header: "Status", render: (n) => <StatusBadge tipo="nfe" valor={n.status} /> },
      ]}
    />
  );
}
