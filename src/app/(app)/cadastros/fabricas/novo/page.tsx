"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { criarFabrica } from "../actions";

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
    <form action={handleSubmit} className="flex max-w-sm flex-col gap-4">
      <h1 className="text-lg font-semibold">Nova fábrica</h1>
      <input name="nome" placeholder="Nome" className="rounded border px-3 py-2" required />
      <input name="cnpj" placeholder="CNPJ" className="rounded border px-3 py-2" required />
      {erros.map((erro) => (
        <p key={erro} className="text-sm text-red-600">{erro}</p>
      ))}
      <button type="submit" className="rounded bg-black px-3 py-2 text-white">Salvar</button>
    </form>
  );
}
