"use client";

import { Select } from "@/components/ui/select/select";
import { Input } from "@/components/ui/input/input";
import { Button } from "@/components/ui/buttons/button";

type Opcao = { id: string; label: string };

export function AuditoriaFiltros({
  usuarios,
  entidades,
  selecionado,
}: {
  usuarios: Opcao[];
  entidades: Opcao[];
  selecionado: { de?: string; ate?: string; usuarioId?: string; entidade?: string };
}) {
  const TODOS: Opcao = { id: "", label: "Todos" };

  return (
    <form method="get" className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      <Input type="date" name="de" label="De" defaultValue={selecionado.de ?? ""} className="sm:w-44" />
      <Input type="date" name="ate" label="Até" defaultValue={selecionado.ate ?? ""} className="sm:w-44" />
      <Select name="usuarioId" label="Usuário" defaultSelectedKey={selecionado.usuarioId ?? ""} className="sm:w-52" items={[TODOS, ...usuarios]}>
        {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
      </Select>
      <Select name="entidade" label="Tipo de registro" defaultSelectedKey={selecionado.entidade ?? ""} className="sm:w-52" items={[TODOS, ...entidades]}>
        {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
      </Select>
      <Button type="submit" color="secondary">Filtrar</Button>
    </form>
  );
}
