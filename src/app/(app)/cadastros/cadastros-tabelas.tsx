"use client";

import { DataTable } from "@/components/patterns/data-table";
import { Selo } from "@/components/patterns/status-badge";

export interface FabricaLinha {
  id: string;
  nome: string;
  cnpj: string;
  ativo: boolean;
}
export interface ClienteLinha {
  id: string;
  nomeFantasia: string;
  cnpj: string | null;
  fabricas: string[];
}
export interface UsuarioLinha {
  id: string;
  nome: string;
  email: string;
  perfil: string;
  ativo: boolean;
  fabricas: string[];
}

function Situacao({ ativo }: { ativo: boolean }) {
  return ativo ? <Selo cor="success">Ativo</Selo> : <Selo cor="gray">Inativo</Selo>;
}

function ListaFabricas({ fabricas }: { fabricas: string[] }) {
  if (fabricas.length === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {fabricas.map((f) => (
        <Selo key={f} cor="gray">{f}</Selo>
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
      rowHref={(f) => `/cadastros/fabricas/${f.id}`}
      vazio="Nenhuma fábrica cadastrada."
      columns={[
        { id: "nome", header: "Nome", isRowHeader: true, render: (f) => <span className="font-medium">{f.nome}</span> },
        { id: "cnpj", header: "CNPJ", render: (f) => f.cnpj },
        { id: "situacao", header: "Situação", render: (f) => <Situacao ativo={f.ativo} /> },
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
      rowHref={(c) => `/cadastros/clientes/${c.id}`}
      vazio="Nenhum cliente cadastrado."
      columns={[
        { id: "nome", header: "Nome fantasia", isRowHeader: true, render: (c) => <span className="font-medium">{c.nomeFantasia}</span> },
        { id: "cnpj", header: "CNPJ", render: (c) => c.cnpj ?? <span className="text-muted-foreground">—</span> },
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
      rowHref={(u) => `/cadastros/usuarios/${u.id}`}
      vazio="Nenhum usuário cadastrado."
      columns={[
        { id: "nome", header: "Nome", isRowHeader: true, render: (u) => <span className="font-medium">{u.nome}</span> },
        { id: "email", header: "E-mail", render: (u) => u.email },
        { id: "perfil", header: "Perfil", render: (u) => <Selo cor={u.perfil === "ADMIN" ? "blue" : "gray"}>{u.perfil}</Selo> },
        { id: "fabricas", header: "Fábricas", render: (u) => <ListaFabricas fabricas={u.fabricas} /> },
        { id: "situacao", header: "Situação", render: (u) => <Situacao ativo={u.ativo} /> },
      ]}
    />
  );
}
