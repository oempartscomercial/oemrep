"use client";

import { DataTable } from "@/components/patterns/data-table";

export interface EventoAuditoriaLinha {
  id: string;
  quando: string;
  usuario: string;
  entidade: string;
  entidadeId: string;
  campo: string;
  de: string;
  para: string;
}

export function AuditoriaTabela({ eventos }: { eventos: EventoAuditoriaLinha[] }) {
  return (
    <DataTable<EventoAuditoriaLinha>
      ariaLabel="Eventos de auditoria"
      data={eventos}
      getRowId={(e) => e.id}
      vazio="Nenhum evento de auditoria no filtro selecionado."
      columns={[
        { id: "quando", header: "Quando", isRowHeader: true, render: (e) => <span className="text-xs text-tertiary">{e.quando}</span> },
        { id: "usuario", header: "Usuário", render: (e) => e.usuario },
        { id: "entidade", header: "Registro", render: (e) => <span>{e.entidade} <span className="text-xs text-quaternary">{e.entidadeId}</span></span> },
        { id: "campo", header: "Campo", render: (e) => e.campo },
        { id: "de", header: "De", render: (e) => <span className="text-tertiary">{e.de}</span> },
        { id: "para", header: "Para", render: (e) => <span className="font-medium text-primary">{e.para}</span> },
      ]}
    />
  );
}
