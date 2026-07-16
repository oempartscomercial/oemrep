"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { criarFabrica } from "../actions";
import { Button } from "@/components/ui/buttons/button";
import { Input } from "@/components/ui/input/input";

export default function NovaFabricaPage() {
  const router = useRouter();
  const [erros, setErros] = useState<string[]>([]);

  async function handleSubmit(formData: FormData) {
    const resultado = await criarFabrica(formData);
    if (resultado.erros.length > 0) {
      setErros(resultado.erros);
      return;
    }
    router.push("/cadastros/fabricas");
  }

  return (
    <form action={handleSubmit} className="flex max-w-lg flex-col gap-5 rounded-xl bg-primary p-6 ring-1 ring-secondary">
      <h1 className="text-lg font-semibold text-primary">Nova fábrica</h1>
      <Input name="nome" label="Nome" placeholder="Nome da fábrica" isRequired />
      <Input name="cnpj" label="CNPJ" placeholder="00.000.000/0000-00" isRequired />
      {erros.length > 0 && (
        <ul className="flex flex-col gap-1">{erros.map((e) => <li key={e} className="text-sm text-error-primary">{e}</li>)}</ul>
      )}
      <div className="flex justify-end gap-3 border-t border-secondary pt-5">
        <Button type="button" color="secondary" href="/cadastros/fabricas">Cancelar</Button>
        <Button type="submit" color="primary">Salvar</Button>
      </div>
    </form>
  );
}
