"use client";

import { CampoSelect } from "@/components/patterns/campo";
import { Botao } from "@/components/patterns/botao";
import { FiltrosBar } from "@/components/patterns/filtros-bar";

type Opcao = { id: string; label: string };

export function PedidosXNfeFiltros({
  fabricas,
  clientes,
  anos,
  meses,
  selecionado,
}: {
  fabricas: Opcao[];
  clientes: Opcao[];
  anos: Opcao[];
  meses: Opcao[];
  selecionado: { fabrica?: string; cliente?: string; ano?: string; mes?: string };
}) {
  const TODOS: Opcao = { id: "", label: "Todos" };

  return (
    <form method="get">
      <FiltrosBar>
        <CampoSelect name="fabrica" rotulo="Fábrica" valorPadrao={selecionado.fabrica ?? ""} className="sm:w-52" opcoes={[TODOS, ...fabricas]} />
        <CampoSelect name="cliente" rotulo="Cliente" valorPadrao={selecionado.cliente ?? ""} className="sm:w-52" opcoes={[TODOS, ...clientes]} />
        <CampoSelect name="ano" rotulo="Ano" valorPadrao={selecionado.ano ?? ""} className="sm:w-32" opcoes={[TODOS, ...anos]} />
        <CampoSelect name="mes" rotulo="Mês" valorPadrao={selecionado.mes ?? ""} className="sm:w-40" opcoes={[TODOS, ...meses]} />
        <Botao type="submit">Filtrar</Botao>
      </FiltrosBar>
    </form>
  );
}
