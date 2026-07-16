"use client";

import { Select } from "@/components/ui/select/select";
import { Button } from "@/components/ui/buttons/button";

type Opcao = { id: string; label: string };

export function PedidosXNfeFiltros({
  fabricas,
  clientes,
  meses,
  selecionado,
}: {
  fabricas: Opcao[];
  clientes: Opcao[];
  meses: Opcao[];
  selecionado: { fabrica?: string; cliente?: string; mes?: string };
}) {
  const TODOS: Opcao = { id: "", label: "Todos" };

  return (
    <form method="get" className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      <Select name="fabrica" label="Fábrica" defaultSelectedKey={selecionado.fabrica ?? ""} className="sm:w-52" items={[TODOS, ...fabricas]}>
        {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
      </Select>
      <Select name="cliente" label="Cliente" defaultSelectedKey={selecionado.cliente ?? ""} className="sm:w-52" items={[TODOS, ...clientes]}>
        {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
      </Select>
      <Select name="mes" label="Mês" defaultSelectedKey={selecionado.mes ?? ""} className="sm:w-40" items={[TODOS, ...meses]}>
        {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
      </Select>
      <Button type="submit" color="secondary">Filtrar</Button>
    </form>
  );
}
