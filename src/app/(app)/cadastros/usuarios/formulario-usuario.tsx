"use client";

import { Input } from "@/components/ui/input/input";
import { Select } from "@/components/ui/select/select";
import { Checkbox } from "@/components/ui/checkbox/checkbox";
import { FormularioCadastro, type AcaoCadastro } from "../formulario";

type Fabrica = { id: string; nome: string };

export function FormularioUsuario({
  titulo,
  acao,
  fabricas,
  inicial,
}: {
  titulo: string;
  acao: AcaoCadastro;
  fabricas: Fabrica[];
  inicial?: { nome: string; email: string; perfil: string; fabricasIds: string[] };
}) {
  return (
    <FormularioCadastro titulo={titulo} acao={acao} voltarPara="/cadastros/usuarios">
      <Input name="nome" label="Nome" placeholder="Nome completo" isRequired defaultValue={inicial?.nome} />
      <Input
        name="email"
        type="email"
        label="E-mail"
        placeholder="pessoa@empresa.com.br"
        isRequired={!inicial}
        isDisabled={!!inicial}
        hint={inicial ? "O e-mail não muda: é ele que liga o cadastro ao login." : undefined}
        defaultValue={inicial?.email}
      />

      <Select name="perfil" label="Perfil" defaultSelectedKey={inicial?.perfil ?? "OPERADOR"}>
        <Select.Item id="OPERADOR">Operador</Select.Item>
        <Select.Item id="ANALISTA">Analista</Select.Item>
        <Select.Item id="ADMIN">Admin</Select.Item>
      </Select>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-secondary">Fábricas autorizadas</legend>
        {fabricas.map((f) => (
          <Checkbox key={f.id} name="fabricasIds" value={f.id} label={f.nome} defaultSelected={inicial?.fabricasIds.includes(f.id)} />
        ))}
      </fieldset>

      {!inicial && (
        <p className="rounded-lg bg-secondary/50 p-3 text-xs text-tertiary ring-1 ring-secondary">
          Crie a senha desta pessoa no painel do Supabase com o mesmo e-mail. O vínculo é feito
          automaticamente no primeiro acesso.
        </p>
      )}
    </FormularioCadastro>
  );
}
