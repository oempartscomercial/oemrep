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
    <div className="flex flex-col gap-6">
      {grupos.map((grupo) => (
        <div key={grupo.pedidoId} className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-primary">Pedido {grupo.pedidoNumero}</h2>
          <DataTable<LinhaFaturamento>
            ariaLabel={`Itens faturados do pedido ${grupo.pedidoNumero}`}
            data={grupo.linhas}
            getRowId={(l) => `${l.pedidoId}-${l.referencia}`}
            columns={[
              { id: "referencia", header: "Referência", isRowHeader: true, render: (l) => <span className="font-medium text-primary">{l.referencia}</span> },
              { id: "descricao", header: "Descrição", render: (l) => l.descricao },
              { id: "qtd", header: "Qtd. faturada", render: (l) => l.quantidadeFaturada },
              { id: "valor", header: "Valor unit.", render: (l) => formatarReais(l.valorUnitario) },
            ]}
          />
          <p className="text-sm text-tertiary">
            Total faturado neste pedido: <span className="font-semibold text-primary">{formatarReais(grupo.totalFaturado)}</span>
          </p>
        </div>
      ))}
    </div>
  );
}
