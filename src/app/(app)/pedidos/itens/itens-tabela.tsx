"use client";

import { DataTable } from "@/components/patterns/data-table";
import { StatusBadge } from "@/components/patterns/status-badge";

export interface ItemLinha {
  id: string;
  pedidoId: string;
  pedidoNumero: string;
  data: string;
  fabrica: string;
  cliente: string;
  referencia: string;
  descricao: string;
  quantidadePedida: number;
  quantidadeFaturada: number;
  quantidadePendente: number;
  valorUnitario: string;
  status: string;
}

export function ItensTabela({ itens }: { itens: ItemLinha[] }) {
  return (
    <DataTable<ItemLinha>
      ariaLabel="Itens de pedido"
      data={itens}
      getRowId={(i) => i.id}
      rowHref={(i) => `/pedidos/${i.pedidoId}`}
      vazio="Nenhum item com estes filtros."
      columns={[
        { id: "ref", header: "Referência", isRowHeader: true, render: (i) => <span className="font-medium text-primary">{i.referencia}</span> },
        { id: "desc", header: "Descrição", render: (i) => i.descricao },
        { id: "pedido", header: "Pedido", render: (i) => <span>{i.pedidoNumero} <span className="text-xs text-tertiary">{i.data}</span></span> },
        { id: "fabrica", header: "Fábrica", render: (i) => i.fabrica },
        { id: "cliente", header: "Cliente", render: (i) => i.cliente },
        { id: "qtd", header: "Pedida", render: (i) => i.quantidadePedida },
        { id: "fat", header: "Faturada", render: (i) => i.quantidadeFaturada },
        { id: "pend", header: "Pendente", render: (i) => <span className="font-medium text-primary">{i.quantidadePendente}</span> },
        { id: "valor", header: "Valor unit.", render: (i) => i.valorUnitario },
        { id: "status", header: "Status", render: (i) => <StatusBadge tipo="item" valor={i.status} /> },
      ]}
    />
  );
}
