"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { criarUsuario } from "../actions";
import { Button } from "@/components/ui/buttons/button";
import { Input } from "@/components/ui/input/input";
import { Select } from "@/components/ui/select/select";
import { Checkbox } from "@/components/ui/checkbox/checkbox";

type Fabrica = { id: string; nome: string };

export default function NovoUsuarioPage() {
  const router = useRouter();
  const [erros, setErros] = useState<string[]>([]);
  const [fabricas, setFabricas] = useState<Fabrica[]>([]);

  useEffect(() => {
    fetch("/api/fabricas").then((r) => r.json()).then(setFabricas);
  }, []);

  async function handleSubmit(formData: FormData) {
    const resultado = await criarUsuario(formData);
    if (resultado.erros.length > 0) {
      setErros(resultado.erros);
      return;
    }
    router.push("/cadastros/usuarios");
  }

  return (
    <form action={handleSubmit} className="flex max-w-lg flex-col gap-5 rounded-xl bg-primary p-6 ring-1 ring-secondary">
      <h1 className="text-lg font-semibold text-primary">Novo usuário</h1>
      <Input name="nome" label="Nome" placeholder="Nome completo" isRequired />
      <Input name="email" type="email" label="E-mail" placeholder="pessoa@empresa.com.br" isRequired />

      <Select name="perfil" label="Perfil" defaultSelectedKey="OPERADOR">
        <Select.Item id="OPERADOR">Operador</Select.Item>
        <Select.Item id="ANALISTA">Analista</Select.Item>
        <Select.Item id="ADMIN">Admin</Select.Item>
      </Select>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-secondary">Fábricas autorizadas</legend>
        {fabricas.map((f) => (
          <Checkbox key={f.id} name="fabricasIds" value={f.id} label={f.nome} />
        ))}
      </fieldset>

      <p className="rounded-lg bg-secondary/50 p-3 text-xs text-tertiary ring-1 ring-secondary">
        Crie a senha desta pessoa no painel do Supabase com o mesmo e-mail. O vínculo é feito
        automaticamente no primeiro acesso.
      </p>

      {erros.length > 0 && (
        <ul className="flex flex-col gap-1">{erros.map((e) => <li key={e} className="text-sm text-error-primary">{e}</li>)}</ul>
      )}
      <div className="flex justify-end gap-3 border-t border-secondary pt-5">
        <Button type="button" color="secondary" href="/cadastros/usuarios">Cancelar</Button>
        <Button type="submit" color="primary">Salvar</Button>
      </div>
    </form>
  );
}
