"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { criarCliente } from "../actions";
import { Button } from "@/components/ui/buttons/button";
import { Input } from "@/components/ui/input/input";
import { Select } from "@/components/ui/select/select";
import { Checkbox } from "@/components/ui/checkbox/checkbox";

type Fabrica = { id: string; nome: string };

export default function NovoClientePage() {
  const router = useRouter();
  const [erros, setErros] = useState<string[]>([]);
  const [fabricas, setFabricas] = useState<Fabrica[]>([]);

  useEffect(() => {
    fetch("/api/fabricas").then((r) => r.json()).then(setFabricas);
  }, []);

  async function handleSubmit(formData: FormData) {
    const resultado = await criarCliente(formData);
    if (resultado.erros.length > 0) {
      setErros(resultado.erros);
      return;
    }
    router.push("/cadastros/clientes");
  }

  return (
    <form action={handleSubmit} className="flex max-w-lg flex-col gap-5 rounded-xl bg-primary p-6 ring-1 ring-secondary">
      <h1 className="text-lg font-semibold text-primary">Novo cliente</h1>
      <Input name="nomeFantasia" label="Nome fantasia" placeholder="Nome do cliente" isRequired />
      <Input name="cnpj" label="CNPJ" placeholder="00.000.000/0000-00" isRequired />

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-secondary">Fábricas atendidas</legend>
        {fabricas.map((f) => (
          <Checkbox key={f.id} name="fabricasIds" value={f.id} label={f.nome} />
        ))}
      </fieldset>

      <Select name="tipoConfirmacaoEstoque" label="Confirmação de estoque" defaultSelectedKey="PRESUMIDA">
        <Select.Item id="PRESUMIDA">Confirmação presumida</Select.Item>
        <Select.Item id="AUTOMATICA">Confirmação automática</Select.Item>
      </Select>

      <Checkbox name="flagAcessoSistema" value="on" label="Tem acesso ao sistema interno da fábrica" />

      {erros.length > 0 && (
        <ul className="flex flex-col gap-1">{erros.map((e) => <li key={e} className="text-sm text-error-primary">{e}</li>)}</ul>
      )}
      <div className="flex justify-end gap-3 border-t border-secondary pt-5">
        <Button type="button" color="secondary" href="/cadastros/clientes">Cancelar</Button>
        <Button type="submit" color="primary">Salvar</Button>
      </div>
    </form>
  );
}
