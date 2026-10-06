"use client";

import { DataTable } from "@/components/patterns/data-table";

export interface AlertaLinha {
  id: string;
  numero: string;
  fabrica: string;
  cliente: string;
  diasSemNfe: number;
}

export function AlertasTabela({ alertas }: { alertas: AlertaLinha[] }) {
  return (
    <DataTable<AlertaLinha>
      ariaLabel="Pedidos sem NFe vencidos"
      data={alertas}
      getRowId={(a) => a.id}
      rowHref={(a) => `/pedidos/${a.id}`}
      vazio="Nenhum pedido sem NFe fora do prazo. 🎉"
      columns={[
        { id: "numero", header: "Pedido", isRowHeader: true, render: (a) => <span className="font-medium">{a.numero}</span> },
        { id: "fabrica", header: "Fábrica", render: (a) => a.fabrica },
        { id: "cliente", header: "Cliente", render: (a) => a.cliente },
        { id: "dias", header: "Dias sem NFe", numerica: true, render: (a) => <span className="font-medium text-destructive">{a.diasSemNfe}</span> },
      ]}
    />
  );
}
