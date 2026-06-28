"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { criarCliente } from "../actions";

type Fabrica = { id: string; nome: string };

export default function NovoClientePage() {
  const router = useRouter();
  const [erros, setErros] = useState<string[]>([]);
  const [fabricas, setFabricas] = useState<Fabrica[]>([]);

  useEffect(() => {
    fetch("/api/fabricas")
      .then((r) => r.json())
      .then(setFabricas);
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
    <form action={handleSubmit} className="flex max-w-sm flex-col gap-4">
      <h1 className="text-lg font-semibold">Novo cliente</h1>
      <input name="nomeFantasia" placeholder="Nome fantasia" className="rounded border px-3 py-2" required />
      <input name="cnpj" placeholder="CNPJ" className="rounded border px-3 py-2" required />
      <fieldset className="flex flex-col gap-1">
        <legend className="text-sm font-medium">Fábricas atendidas</legend>
        {fabricas.map((f) => (
          <label key={f.id} className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="fabricasIds" value={f.id} />
            {f.nome}
          </label>
        ))}
      </fieldset>
      <select name="tipoConfirmacaoEstoque" className="rounded border px-3 py-2">
        <option value="PRESUMIDA">Confirmação presumida</option>
        <option value="AUTOMATICA">Confirmação automática</option>
      </select>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="flagAcessoSistema" />
        Tem acesso ao sistema interno da fábrica
      </label>
      {erros.map((erro) => (
        <p key={erro} className="text-sm text-red-600">{erro}</p>
      ))}
      <button type="submit" className="rounded bg-black px-3 py-2 text-white">Salvar</button>
    </form>
  );
}
