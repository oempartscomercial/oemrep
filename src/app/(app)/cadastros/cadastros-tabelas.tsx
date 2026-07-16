"use client";

import { DataTable } from "@/components/patterns/data-table";
import { Badge } from "@/components/ui/badges/badges";

export interface FabricaLinha {
  id: string;
  nome: string;
  cnpj: string;
}
export interface ClienteLinha {
  id: string;
  nomeFantasia: string;
  cnpj: string;
  fabricas: string[];
}
export interface UsuarioLinha {
  id: string;
  nome: string;
  email: string;
  perfil: string;
  fabricas: string[];
}

function ListaFabricas({ fabricas }: { fabricas: string[] }) {
  if (fabricas.length === 0) return <span className="text-tertiary">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {fabricas.map((f) => (
        <Badge key={f} color="gray" type="pill-color" size="sm">{f}</Badge>
      ))}
    </div>
  );
}

export function FabricasTabela({ fabricas }: { fabricas: FabricaLinha[] }) {
  return (
    <DataTable<FabricaLinha>
      ariaLabel="Fábricas"
      data={fabricas}
      getRowId={(f) => f.id}
      vazio="Nenhuma fábrica cadastrada."
      columns={[
        { id: "nome", header: "Nome", isRowHeader: true, render: (f) => <span className="font-medium text-primary">{f.nome}</span> },
        { id: "cnpj", header: "CNPJ", render: (f) => f.cnpj },
      ]}
    />
  );
}

export function ClientesTabela({ clientes }: { clientes: ClienteLinha[] }) {
  return (
    <DataTable<ClienteLinha>
      ariaLabel="Clientes"
      data={clientes}
      getRowId={(c) => c.id}
      vazio="Nenhum cliente cadastrado."
      columns={[
        { id: "nome", header: "Nome fantasia", isRowHeader: true, render: (c) => <span className="font-medium text-primary">{c.nomeFantasia}</span> },
        { id: "cnpj", header: "CNPJ", render: (c) => c.cnpj },
        { id: "fabricas", header: "Fábricas", render: (c) => <ListaFabricas fabricas={c.fabricas} /> },
      ]}
    />
  );
}

export function UsuariosTabela({ usuarios }: { usuarios: UsuarioLinha[] }) {
  return (
    <DataTable<UsuarioLinha>
      ariaLabel="Usuários"
      data={usuarios}
      getRowId={(u) => u.id}
      vazio="Nenhum usuário cadastrado."
      columns={[
        { id: "nome", header: "Nome", isRowHeader: true, render: (u) => <span className="font-medium text-primary">{u.nome}</span> },
        { id: "email", header: "E-mail", render: (u) => u.email },
        { id: "perfil", header: "Perfil", render: (u) => <Badge color={u.perfil === "ADMIN" ? "brand" : "gray"} type="pill-color" size="sm">{u.perfil}</Badge> },
        { id: "fabricas", header: "Fábricas", render: (u) => <ListaFabricas fabricas={u.fabricas} /> },
      ]}
    />
  );
}
