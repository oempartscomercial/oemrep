"use client";

import { CampoSelect, CampoTexto } from "@/components/patterns/campo";

export type PassoForm = { acao: string; prazo: string; responsavelId: string };

/** Campos do próximo passo (ação, data, responsável). Usados em todo lugar onde ele é exigido. */
export function PassoCampos({
  valor,
  aoMudar,
  responsaveis,
  rotulo = "Próximo passo",
}: {
  valor: PassoForm;
  aoMudar: (v: PassoForm) => void;
  responsaveis: { id: string; nome: string }[];
  rotulo?: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <CampoTexto
        rotulo={rotulo}
        placeholder="Ex.: Ligar para o comprador"
        value={valor.acao}
        onChange={(e) => aoMudar({ ...valor, acao: e.target.value })}
      />
      <div className="grid grid-cols-2 gap-3">
        <CampoTexto rotulo="Quando" type="date" value={valor.prazo} onChange={(e) => aoMudar({ ...valor, prazo: e.target.value })} />
        <CampoSelect
          rotulo="Quem"
          name="responsavel-passo"
          opcoes={responsaveis.map((r) => ({ id: r.id, label: r.nome }))}
          valor={valor.responsavelId}
          aoMudar={(id) => aoMudar({ ...valor, responsavelId: id })}
        />
      </div>
    </div>
  );
}
