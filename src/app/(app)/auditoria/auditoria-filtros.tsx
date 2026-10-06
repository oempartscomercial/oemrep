"use client";

import { CampoSelect, CampoTexto, type OpcaoSelect } from "@/components/patterns/campo";
import { FiltrosBar } from "@/components/patterns/filtros-bar";
import { Botao } from "@/components/patterns/botao";

export function AuditoriaFiltros({
  usuarios,
  entidades,
  selecionado,
}: {
  usuarios: OpcaoSelect[];
  entidades: OpcaoSelect[];
  selecionado: { de?: string; ate?: string; usuarioId?: string; entidade?: string };
}) {
  const TODOS: OpcaoSelect = { id: "", label: "Todos" };

  return (
    <form method="get">
      <FiltrosBar>
        <CampoTexto type="date" name="de" rotulo="De" defaultValue={selecionado.de ?? ""} className="sm:w-44" />
        <CampoTexto type="date" name="ate" rotulo="Até" defaultValue={selecionado.ate ?? ""} className="sm:w-44" />
        <CampoSelect name="usuarioId" rotulo="Usuário" valorPadrao={selecionado.usuarioId ?? ""} className="sm:w-52" opcoes={[TODOS, ...usuarios]} />
        <CampoSelect name="entidade" rotulo="Tipo de registro" valorPadrao={selecionado.entidade ?? ""} className="sm:w-52" opcoes={[TODOS, ...entidades]} />
        <Botao type="submit">Filtrar</Botao>
      </FiltrosBar>
    </form>
  );
}
