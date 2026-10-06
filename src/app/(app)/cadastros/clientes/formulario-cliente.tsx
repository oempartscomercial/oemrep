"use client";

import { Input } from "@/components/ui/input/input";
import { Select } from "@/components/ui/select/select";
import { Checkbox } from "@/components/ui/checkbox/checkbox";
import { FormularioCadastro, type AcaoCadastro } from "../formulario";

type Fabrica = { id: string; nome: string };

export function FormularioCliente({
  titulo,
  acao,
  fabricas,
  inicial,
}: {
  titulo: string;
  acao: AcaoCadastro;
  fabricas: Fabrica[];
  inicial?: { nomeFantasia: string; cnpj: string | null; fabricasIds: string[] };
}) {
  return (
    <FormularioCadastro titulo={titulo} acao={acao} voltarPara="/cadastros/clientes">
      <Input name="nomeFantasia" label="Nome fantasia" placeholder="Nome do cliente" isRequired defaultValue={inicial?.nomeFantasia} />
      <Input
        name="cnpj"
        label="CNPJ"
        placeholder="00.000.000/0000-00"
        hint="Opcional. Se ficar em branco, é pedido na conferência da primeira nota fiscal."
        defaultValue={inicial?.cnpj ?? undefined}
      />

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-secondary">Fábricas atendidas</legend>
        {fabricas.map((f) => (
          <Checkbox
            key={f.id}
            name="fabricasIds"
            value={f.id}
            label={f.nome}
            defaultSelected={inicial?.fabricasIds.includes(f.id)}
          />
        ))}
      </fieldset>

      {!inicial && (
        <>
          <Select name="tipoConfirmacaoEstoque" label="Confirmação de estoque" defaultSelectedKey="PRESUMIDA">
            <Select.Item id="PRESUMIDA">Confirmação presumida</Select.Item>
            <Select.Item id="AUTOMATICA">Confirmação automática</Select.Item>
          </Select>
          <Checkbox name="flagAcessoSistema" value="on" label="Tem acesso ao sistema interno da fábrica" />
        </>
      )}
    </FormularioCadastro>
  );
}
