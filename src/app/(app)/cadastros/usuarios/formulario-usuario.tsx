"use client";

import { Campo, CampoSelect, CampoTexto } from "@/components/patterns/campo";
import { Checkbox } from "@/components/ui/checkbox";
import { FormularioCadastro, type AcaoCadastro } from "../formulario";

type Fabrica = { id: string; nome: string };

const PERFIS = [
  { id: "OPERADOR", label: "Operador" },
  { id: "ANALISTA", label: "Analista" },
  { id: "ADMIN", label: "Admin" },
];

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
      <CampoTexto name="nome" rotulo="Nome" placeholder="Nome completo" obrigatorio defaultValue={inicial?.nome} />
      <CampoTexto
        name="email"
        type="email"
        rotulo="E-mail"
        placeholder="pessoa@empresa.com.br"
        obrigatorio={!inicial}
        disabled={!!inicial}
        dica={inicial ? "O e-mail não muda: é ele que liga o cadastro ao login." : undefined}
        defaultValue={inicial?.email}
      />

      <CampoSelect name="perfil" rotulo="Perfil" opcoes={PERFIS} valorPadrao={inicial?.perfil ?? "OPERADOR"} />

      <Campo rotulo="Fábricas autorizadas">
        <div role="group" aria-label="Fábricas autorizadas" className="flex flex-col gap-2">
          {fabricas.map((f) => (
            <label key={f.id} className="flex items-center gap-2 text-sm">
              <Checkbox name="fabricasIds" value={f.id} defaultChecked={inicial?.fabricasIds.includes(f.id)} />
              {f.nome}
            </label>
          ))}
        </div>
      </Campo>

      {!inicial && (
        <label className="flex items-start gap-2 rounded-lg border bg-muted/40 p-3 text-sm">
          <Checkbox name="enviarConvite" defaultChecked className="mt-0.5" />
          <span className="flex flex-col gap-0.5">
            <span>Enviar convite por e-mail agora</span>
            <span className="text-xs text-muted-foreground">
              A pessoa recebe um link para criar a própria senha. Sem convite, ela só entra depois que você enviar um.
            </span>
          </span>
        </label>
      )}
    </FormularioCadastro>
  );
}
