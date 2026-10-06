"use client";

import { DataTable } from "@/components/patterns/data-table";
import { Selo } from "@/components/patterns/status-badge";
import { SeloSituacao } from "@/components/crm/selo-situacao";

export interface EmpresaLinha {
  id: string;
  nome: string;
  local: string;
  situacao: string;
  fabricas: string[];
  passo: { acao: string; quando: string; atrasado: boolean } | null;
  ultimoContato: string | null;
}

export function EmpresasTabela({ empresas }: { empresas: EmpresaLinha[] }) {
  return (
    <DataTable<EmpresaLinha>
      ariaLabel="Empresas"
      data={empresas}
      getRowId={(e) => e.id}
      rowHref={(e) => `/empresas/${e.id}`}
      vazio="Nenhuma empresa encontrada."
      columns={[
        {
          id: "nome",
          header: "Empresa",
          isRowHeader: true,
          render: (e) => (
            <div className="flex flex-col leading-tight">
              <span className="font-medium">{e.nome}</span>
              {e.local && <span className="text-xs text-muted-foreground">{e.local}</span>}
            </div>
          ),
        },
        { id: "situacao", header: "Etapa", render: (e) => <SeloSituacao situacao={e.situacao} /> },
        {
          id: "passo",
          header: "Próximo passo",
          render: (e) =>
            e.passo ? (
              <div className="flex flex-col leading-tight">
                <span className="truncate">{e.passo.acao}</span>
                <span className={e.passo.atrasado ? "text-xs font-medium text-destructive" : "text-xs text-muted-foreground"}>{e.passo.quando}</span>
              </div>
            ) : (
              <span className="text-muted-foreground">—</span>
            ),
        },
        {
          id: "fabricas",
          header: "Fábricas",
          render: (e) =>
            e.fabricas.length ? (
              <div className="flex flex-wrap gap-1">
                {e.fabricas.map((f) => (
                  <Selo key={f}>{f}</Selo>
                ))}
              </div>
            ) : (
              <span className="text-muted-foreground">—</span>
            ),
        },
        { id: "ultimo", header: "Último contato", render: (e) => e.ultimoContato ?? <span className="text-muted-foreground">—</span> },
      ]}
    />
  );
}
