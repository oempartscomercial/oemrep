"use client";

import Link from "next/link";
import { DataTable } from "@/components/patterns/data-table";
import { StatusBadge } from "@/components/patterns/status-badge";
import { formatarReais } from "@/domain/formato/moeda";
import { cn } from "@/lib/utils";

export interface PedidoLinha {
  id: string;
  numero: string;
  numeroCliente: string | null;
  fabrica: string;
  cliente: string;
  data: string;
  /** Quanto falta faturar (ou o total, se concluído). */
  valor: number;
  notas: { id: string; numero: string }[];
  /** Só para pedido sem nota. */
  diasSemNota: number | null;
  rapidoSemItens: boolean;
  estado: string;
}

/** A partir de quantos dias sem nota o pedido chama atenção na lista. */
export const DIAS_ALERTA_SEM_NOTA = 15;

export function PedidosTabela({
  pedidos,
  mostrarFabrica = true,
  rotuloValor = "A faturar",
}: {
  pedidos: PedidoLinha[];
  mostrarFabrica?: boolean;
  rotuloValor?: string;
}) {
  return (
    <DataTable<PedidoLinha>
      ariaLabel="Pedidos"
      data={pedidos}
      getRowId={(p) => p.id}
      rowHref={(p) => `/pedidos/${p.id}`}
      vazio="Nenhum pedido nesta situação."
      columns={[
        {
          id: "numero",
          header: "Pedido",
          isRowHeader: true,
          render: (p) => (
            <div className="flex flex-col">
              <span className="font-medium text-foreground">{p.numero}</span>
              {(p.numeroCliente || p.rapidoSemItens) && (
                <span className="text-xs whitespace-normal text-muted-foreground">
                  {[p.numeroCliente && `OC ${p.numeroCliente}`, p.rapidoSemItens && "sem itens"].filter(Boolean).join(" · ")}
                </span>
              )}
            </div>
          ),
        },
        ...(mostrarFabrica ? [{ id: "fabrica", header: "Fábrica", classe: "hidden md:table-cell", render: (p: PedidoLinha) => p.fabrica }] : []),
        { id: "cliente", header: "Cliente", render: (p) => p.cliente },
        { id: "data", header: "Data", classe: "hidden md:table-cell", render: (p) => p.data },
        { id: "valor", header: rotuloValor, numerica: true, render: (p) => <span className="tabular-nums">{formatarReais(p.valor)}</span> },
        {
          id: "notas",
          header: "NFes",
          classe: "hidden lg:table-cell",
          render: (p) =>
            p.notas.length === 0 ? (
              <span className="text-muted-foreground">—</span>
            ) : (
              <span className="flex flex-wrap gap-1">
                {p.notas.map((n) => (
                  <Link
                    key={n.id}
                    href={`/rastreio/${n.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="rounded border px-1.5 py-0.5 text-xs tabular-nums hover:bg-muted"
                  >
                    {n.numero}
                  </Link>
                ))}
              </span>
            ),
        },
        {
          id: "dias",
          header: "Sem nota há",
          numerica: true,
          classe: "hidden sm:table-cell",
          render: (p) =>
            p.diasSemNota === null ? (
              <span className="text-muted-foreground">—</span>
            ) : (
              <span className={cn("tabular-nums", p.diasSemNota >= DIAS_ALERTA_SEM_NOTA && "font-medium text-warning")}>
                {p.diasSemNota} {p.diasSemNota === 1 ? "dia" : "dias"}
              </span>
            ),
        },
        { id: "estado", header: "Situação", classe: "hidden sm:table-cell", render: (p) => <StatusBadge tipo="pedido" valor={p.estado} /> },
      ]}
    />
  );
}
