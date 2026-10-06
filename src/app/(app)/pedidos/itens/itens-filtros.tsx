"use client";

import { Select } from "@/components/ui/select/select";
import { Input } from "@/components/ui/input/input";
import { Button } from "@/components/ui/buttons/button";
import type { FiltroItens } from "@/domain/pedido/filtro-itens";

type Opcao = { id: string; label: string };

const STATUS: Opcao[] = [
  { id: "PENDENTE", label: "Pendentes" },
  { id: "OK", label: "OK" },
  { id: "FORA_DE_FABRICACAO", label: "Fora de fabricação" },
  { id: "DESISTENCIA", label: "Desistência" },
  { id: "TODOS", label: "Todos" },
];

export function ItensFiltros({ fabricas, clientes, filtro }: { fabricas: Opcao[]; clientes: Opcao[]; filtro: FiltroItens }) {
  const TODAS: Opcao = { id: "", label: "Todas" };
  const TODOS: Opcao = { id: "", label: "Todos" };
  return (
    <form method="get" className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      <Select name="status" label="Status" defaultSelectedKey={filtro.status} className="sm:w-44" items={STATUS}>
        {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
      </Select>
      <Select name="fabricaId" label="Fábrica" defaultSelectedKey={filtro.fabricaId ?? ""} className="sm:w-44" items={[TODAS, ...fabricas]}>
        {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
      </Select>
      <Select name="clienteId" label="Cliente" defaultSelectedKey={filtro.clienteId ?? ""} className="sm:w-56" items={[TODOS, ...clientes]}>
        {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
      </Select>
      <Input type="month" name="mes" label="Mês do pedido" defaultValue={filtro.mes ?? ""} className="sm:w-44" />
      <Input name="referencia" label="Referência" placeholder="Ex.: BW-100" defaultValue={filtro.referencia ?? ""} className="sm:w-44" />
      <Button type="submit" color="secondary">Filtrar</Button>
    </form>
  );
}
