"use client";

import { DataTable } from "@/components/patterns/data-table";
import { StatusBadge } from "@/components/patterns/status-badge";

export interface PedidoLinha {
  id: string;
  numero: string;
  fabrica: string;
  cliente: string;
  qtdItens: number;
  estado: string;
}

export function PedidosTabela({ pedidos }: { pedidos: PedidoLinha[] }) {
  return (
    <DataTable<PedidoLinha>
      ariaLabel="Pedidos"
      data={pedidos}
      getRowId={(p) => p.id}
      rowHref={(p) => `/pedidos/${p.id}`}
      vazio="Nenhum pedido nesta situação."
      columns={[
        { id: "numero", header: "Número", isRowHeader: true, render: (p) => <span className="font-medium text-primary">{p.numero}</span> },
        { id: "fabrica", header: "Fábrica", render: (p) => p.fabrica },
        { id: "cliente", header: "Cliente", render: (p) => p.cliente },
        { id: "itens", header: "Itens", render: (p) => p.qtdItens },
        { id: "estado", header: "Situação", render: (p) => <StatusBadge tipo="pedido" valor={p.estado} /> },
      ]}
    />
  );
}
