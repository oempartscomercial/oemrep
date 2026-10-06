"use client";

import { CampoTexto } from "@/components/patterns/campo";
import { FormularioCadastro, type AcaoCadastro } from "../formulario";

export function FormularioFabrica({ titulo, acao, inicial }: { titulo: string; acao: AcaoCadastro; inicial?: { nome: string; cnpj: string } }) {
  return (
    <FormularioCadastro titulo={titulo} acao={acao} voltarPara="/cadastros/fabricas">
      <CampoTexto name="nome" rotulo="Nome" placeholder="Nome da fábrica" obrigatorio defaultValue={inicial?.nome} />
      <CampoTexto name="cnpj" rotulo="CNPJ" placeholder="00.000.000/0000-00" obrigatorio defaultValue={inicial?.cnpj} />
    </FormularioCadastro>
  );
}
