"use client";

import { CampoTexto } from "@/components/patterns/campo";
import { FormularioCadastro, type AcaoCadastro } from "../formulario";

export function FormularioFabrica({ titulo, acao, inicial }: { titulo: string; acao: AcaoCadastro; inicial?: { nome: string; cnpj: string; slaDiasSemNota: number | null } }) {
  return (
    <FormularioCadastro titulo={titulo} acao={acao} voltarPara="/cadastros/fabricas">
      <CampoTexto name="nome" rotulo="Nome" placeholder="Nome da fábrica" obrigatorio defaultValue={inicial?.nome} />
      <CampoTexto name="cnpj" rotulo="CNPJ" placeholder="00.000.000/0000-00" obrigatorio defaultValue={inicial?.cnpj} />
      <CampoTexto
        name="slaDiasSemNota"
        rotulo="Prazo para emitir a nota (dias)"
        type="number"
        min={1}
        max={365}
        inputMode="numeric"
        placeholder="Padrão do sistema"
        dica="Depois desse prazo sem nota, o pedido vira alerta. Deixe vazio para usar o padrão."
        defaultValue={inicial?.slaDiasSemNota ?? ""}
        className="max-w-xs"
      />
    </FormularioCadastro>
  );
}
