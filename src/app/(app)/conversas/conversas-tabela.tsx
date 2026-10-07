"use client";

import { DataTable, type DataTableColumn } from "@/components/patterns/data-table";
import { Selo } from "@/components/patterns/status-badge";

export type ConversaLinha = {
  id: string;
  empresaId: string | null;
  empresa: string | null;
  contato: string | null;
  numero: string;
  motivoSemVinculo: string | null;
  previa: string;
  quando: string;
  total: number;
};

const MOTIVO: Record<string, string> = {
  numero_desconhecido: "Número não cadastrado",
  numero_em_varias_empresas: "Número em mais de uma empresa",
};

export function ConversasTabela({ linhas, titulo, vazio }: { linhas: ConversaLinha[]; titulo: string; vazio: string }) {
  const colunas: DataTableColumn<ConversaLinha>[] = [
    {
      id: "quem",
      header: "Quem",
      isRowHeader: true,
      render: (c) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{c.empresa ?? c.numero}</p>
          <p className="truncate text-xs text-muted-foreground">{[c.contato, c.empresa ? c.numero : null].filter(Boolean).join(" · ") || "—"}</p>
        </div>
      ),
    },
    { id: "previa", header: "Última mensagem", classe: "hidden md:table-cell w-full max-w-0", render: (c) => <span className="block truncate text-muted-foreground" title={c.previa}>{c.previa}</span> },
    {
      id: "situacao",
      header: "",
      render: (c) => (c.motivoSemVinculo ? <Selo cor="warning">{MOTIVO[c.motivoSemVinculo] ?? "Sem empresa"}</Selo> : null),
    },
    { id: "quando", header: "Quando", render: (c) => <span className="whitespace-nowrap text-muted-foreground">{c.quando}</span> },
    { id: "total", header: "Mensagens", numerica: true, classe: "hidden md:table-cell", render: (c) => <span className="tabular">{c.total}</span> },
  ];
  return (
    <DataTable
      ariaLabel={titulo}
      titulo={titulo}
      columns={colunas}
      data={linhas}
      getRowId={(c) => c.id}
      rowHref={(c) => (c.empresaId ? `/empresas/${c.empresaId}` : undefined)}
      vazio={vazio}
    />
  );
}
