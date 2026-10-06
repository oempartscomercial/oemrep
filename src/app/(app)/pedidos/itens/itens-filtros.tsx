"use client";

import { CampoSelect, CampoTexto } from "@/components/patterns/campo";
import { FiltrosBar } from "@/components/patterns/filtros-bar";
import { Botao } from "@/components/patterns/botao";
import type { FiltroItens } from "@/domain/pedido/filtro-itens";

type Opcao = { id: string; label: string };

const STATUS: Opcao[] = [
  { id: "PENDENTE", label: "Pendentes" },
  { id: "OK", label: "OK" },
  { id: "FORA_DE_FABRICACAO", label: "Fora de fabricação" },
  { id: "DESISTENCIA", label: "Desistência" },
  { id: "TODOS", label: "Todos" },
];

export function ItensFiltros({ fabricas, clientes, filtro }: { fabricas: Opcao[]; clientes: Opcao[]; filtro: FiltroItens }) {
  const TODAS: Opcao = { id: "", label: "Todas" };
  const TODOS: Opcao = { id: "", label: "Todos" };
  return (
    <form method="get">
      <FiltrosBar>
        <CampoSelect name="status" rotulo="Status" valorPadrao={filtro.status} className="sm:w-44" opcoes={STATUS} />
        <CampoSelect name="fabricaId" rotulo="Fábrica" valorPadrao={filtro.fabricaId ?? ""} className="sm:w-44" opcoes={[TODAS, ...fabricas]} />
        <CampoSelect name="clienteId" rotulo="Cliente" valorPadrao={filtro.clienteId ?? ""} className="sm:w-56" opcoes={[TODOS, ...clientes]} />
        <CampoTexto type="month" name="mes" rotulo="Mês do pedido" defaultValue={filtro.mes ?? ""} className="sm:w-44" />
        <CampoTexto name="referencia" rotulo="Referência" placeholder="Ex.: BW-100" defaultValue={filtro.referencia ?? ""} className="sm:w-44" />
        <Botao type="submit" variante="secundario">Filtrar</Botao>
      </FiltrosBar>
    </form>
  );
}
