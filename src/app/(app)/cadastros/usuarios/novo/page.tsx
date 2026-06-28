"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { criarUsuario } from "../actions";

type Fabrica = { id: string; nome: string };

export default function NovoUsuarioPage() {
  const router = useRouter();
  const [erros, setErros] = useState<string[]>([]);
  const [fabricas, setFabricas] = useState<Fabrica[]>([]);

  useEffect(() => {
    fetch("/api/fabricas")
      .then((r) => r.json())
      .then(setFabricas);
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
    <form action={handleSubmit} className="flex max-w-sm flex-col gap-4">
      <h1 className="text-lg font-semibold">Novo usuário</h1>
      <input name="nome" placeholder="Nome" className="rounded border px-3 py-2" required />
      <input name="email" type="email" placeholder="E-mail" className="rounded border px-3 py-2" required />
      <select name="perfil" className="rounded border px-3 py-2">
        <option value="OPERADOR">Operador</option>
        <option value="ANALISTA">Analista</option>
        <option value="ADMIN">Admin</option>
      </select>
      <fieldset className="flex flex-col gap-1">
        <legend className="text-sm font-medium">Fábricas autorizadas</legend>
        {fabricas.map((f) => (
          <label key={f.id} className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="fabricasIds" value={f.id} />
            {f.nome}
          </label>
        ))}
      </fieldset>
      <p className="text-xs text-gray-500">
        Crie a senha desta pessoa no painel do Supabase com o mesmo e-mail. O vínculo é
        feito automaticamente no primeiro acesso.
      </p>
      {erros.map((erro) => (
        <p key={erro} className="text-sm text-red-600">{erro}</p>
      ))}
      <button type="submit" className="rounded bg-black px-3 py-2 text-white">Salvar</button>
    </form>
  );
}
