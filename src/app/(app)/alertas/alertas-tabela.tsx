"use client";

import { DataTable } from "@/components/patterns/data-table";
import { formatarReais } from "@/domain/formato/moeda";
import type { Alerta } from "@/domain/alerta/fila";

export type AlertaLinha = Alerta & { acao: string };

export function AlertasTabela({ alertas, vazio }: { alertas: AlertaLinha[]; vazio: string }) {
  return (
    <DataTable<AlertaLinha>
      ariaLabel="Alertas"
      data={alertas}
      getRowId={(a) => a.chave}
      rowHref={(a) => a.href}
      vazio={vazio}
      columns={[
        {
          id: "alerta",
          header: "Alerta",
          isRowHeader: true,
          render: (a) => (
            <span className="flex flex-col">
              <span className="font-medium">{a.titulo}</span>
              <span className="text-xs text-muted-foreground">{a.detalhe}</span>
            </span>
          ),
        },
        { id: "acao", header: "O que fazer", render: (a) => <span className="text-sm text-muted-foreground">{a.acao}</span> },
        { id: "dias", header: "Dias", numerica: true, render: (a) => <span className="font-medium tabular-nums">{a.dias}</span> },
        { id: "valor", header: "Valor", numerica: true, render: (a) => (a.valor ? <span className="tabular-nums">{formatarReais(a.valor)}</span> : "—") },
      ]}
    />
  );
}
