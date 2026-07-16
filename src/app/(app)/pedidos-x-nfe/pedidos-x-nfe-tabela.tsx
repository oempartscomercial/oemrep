"use client";

import { DataTable } from "@/components/patterns/data-table";
import { cx } from "@/utils/cx";

export interface LinhaGapView {
  id: string;
  mes: string;
  fabrica: string;
  cliente: string;
  valorPedido: string;
  valorFaturado: string;
  gap: number;
  gapFmt: string;
}

export function PedidosXNfeTabela({ linhas }: { linhas: LinhaGapView[] }) {
  return (
    <DataTable<LinhaGapView>
      ariaLabel="Gap de faturamento por mês, fábrica e cliente"
      data={linhas}
      getRowId={(l) => l.id}
      vazio="Nenhum pedido no filtro selecionado."
      columns={[
        { id: "mes", header: "Mês", isRowHeader: true, render: (l) => <span className="font-medium text-primary">{l.mes}</span> },
        { id: "fabrica", header: "Fábrica", render: (l) => l.fabrica },
        { id: "cliente", header: "Cliente", render: (l) => l.cliente },
        { id: "pedido", header: "Valor pedido", render: (l) => l.valorPedido },
        { id: "faturado", header: "Valor faturado", render: (l) => l.valorFaturado },
        {
          id: "gap",
          header: "Gap",
          render: (l) => <span className={cx("font-medium", l.gap > 0 ? "text-error-primary" : "text-primary")}>{l.gapFmt}</span>,
        },
      ]}
    />
  );
}
