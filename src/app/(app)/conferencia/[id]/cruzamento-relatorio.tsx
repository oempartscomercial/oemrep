"use client";

import { DataTable } from "@/components/patterns/data-table";
import type { LinhaFaturamento } from "@/domain/nfe/relatorio";
import { formatarReais } from "@/domain/formato/moeda";

export interface GrupoCruzamento {
  pedidoId: string;
  pedidoNumero: string;
  linhas: LinhaFaturamento[];
  totalFaturado: number;
}

export function CruzamentoRelatorio({ grupos }: { grupos: GrupoCruzamento[] }) {
  return (
    <div className="flex flex-col gap-4">
      {grupos.map((grupo) => (
        <div key={grupo.pedidoId} className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold">Pedido {grupo.pedidoNumero}</h2>
          <DataTable<LinhaFaturamento>
            ariaLabel={`Itens faturados do pedido ${grupo.pedidoNumero}`}
            data={grupo.linhas}
            getRowId={(l) => `${l.pedidoId}-${l.referencia}`}
            columns={[
              { id: "referencia", header: "Referência", isRowHeader: true, render: (l) => <span className="font-medium">{l.referencia}</span> },
              { id: "descricao", header: "Descrição", render: (l) => l.descricao },
              { id: "qtd", header: "Qtd. faturada", numerica: true, render: (l) => l.quantidadeFaturada },
              { id: "valor", header: "Valor unit.", numerica: true, render: (l) => formatarReais(l.valorUnitario) },
            ]}
          />
          <p className="text-sm text-muted-foreground">
            Total faturado neste pedido: <span className="font-semibold text-foreground">{formatarReais(grupo.totalFaturado)}</span>
          </p>
        </div>
      ))}
    </div>
  );
}
