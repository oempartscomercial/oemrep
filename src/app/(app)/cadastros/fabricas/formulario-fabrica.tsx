"use client";

import { Input } from "@/components/ui/input/input";
import { FormularioCadastro, type AcaoCadastro } from "../formulario";

export function FormularioFabrica({ titulo, acao, inicial }: { titulo: string; acao: AcaoCadastro; inicial?: { nome: string; cnpj: string } }) {
  return (
    <FormularioCadastro titulo={titulo} acao={acao} voltarPara="/cadastros/fabricas">
      <Input name="nome" label="Nome" placeholder="Nome da fábrica" isRequired defaultValue={inicial?.nome} />
      <Input name="cnpj" label="CNPJ" placeholder="00.000.000/0000-00" isRequired defaultValue={inicial?.cnpj} />
    </FormularioCadastro>
  );
}
