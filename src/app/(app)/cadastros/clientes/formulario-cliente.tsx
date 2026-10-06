"use client";

import { Campo, CampoSelect, CampoTexto } from "@/components/patterns/campo";
import { Checkbox } from "@/components/ui/checkbox";
import { FormularioCadastro, type AcaoCadastro } from "../formulario";

type Fabrica = { id: string; nome: string };

const CONFIRMACOES = [
  { id: "PRESUMIDA", label: "Confirmação presumida" },
  { id: "AUTOMATICA", label: "Confirmação automática" },
];

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
      <CampoTexto name="nomeFantasia" rotulo="Nome fantasia" placeholder="Nome do cliente" obrigatorio defaultValue={inicial?.nomeFantasia} />
      <CampoTexto
        name="cnpj"
        rotulo="CNPJ"
        placeholder="00.000.000/0000-00"
        dica="Opcional. Se ficar em branco, é pedido na conferência da primeira nota fiscal."
        defaultValue={inicial?.cnpj ?? undefined}
      />

      <Campo rotulo="Fábricas atendidas">
        <div role="group" aria-label="Fábricas atendidas" className="flex flex-col gap-2">
          {fabricas.map((f) => (
            <label key={f.id} className="flex items-center gap-2 text-sm">
              <Checkbox name="fabricasIds" value={f.id} defaultChecked={inicial?.fabricasIds.includes(f.id)} />
              {f.nome}
            </label>
          ))}
        </div>
      </Campo>

      {!inicial && (
        <>
          <CampoSelect name="tipoConfirmacaoEstoque" rotulo="Confirmação de estoque" opcoes={CONFIRMACOES} valorPadrao="PRESUMIDA" />
          <label className="flex items-center gap-2 text-sm">
            <Checkbox name="flagAcessoSistema" value="on" />
            Tem acesso ao sistema interno da fábrica
          </label>
        </>
      )}
    </FormularioCadastro>
  );
}
