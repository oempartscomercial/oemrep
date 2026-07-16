"use client";

import { Tabs } from "@/components/application/tabs/tabs";
import { DataTable } from "@/components/patterns/data-table";
import { StatusBadge } from "@/components/patterns/status-badge";
import { Timeline, type TimelineItem } from "@/components/patterns/timeline";
import type { StatusItemPedido } from "@/domain/pedido/estado";
import { ItemStatusForm } from "./item-status-form";

export interface ItemLinha {
  id: string;
  referencia: string;
  descricao: string;
  quantidadePedida: number;
  quantidadeFaturada: number;
  status: StatusItemPedido;
  observacao: string;
}
export interface NotaLinha {
  id: string;
  numero: string;
  chaveAcesso: string;
  status: string;
}
export interface EventoLinha {
  id: string;
  campo: string;
  valorAnterior: string | null;
  valorNovo: string | null;
  criadoEm: string;
}

export function PedidoDetalheTabs({ itens, notas, eventos }: { itens: ItemLinha[]; notas: NotaLinha[]; eventos: EventoLinha[] }) {
  const timeline: TimelineItem[] = eventos.map((ev) => ({
    id: ev.id,
    titulo: ev.campo,
    descricao: `${ev.valorAnterior ?? "—"} → ${ev.valorNovo ?? "—"}`,
    data: new Date(ev.criadoEm).toLocaleString("pt-BR"),
  }));

  return (
    <Tabs defaultSelectedKey="itens">
      <Tabs.List>
        <Tabs.Item id="itens" label="Itens" />
        <Tabs.Item id="notas" label="Notas fiscais" />
        <Tabs.Item id="historico" label="Histórico" />
      </Tabs.List>

      <Tabs.Panel id="itens" className="pt-5">
        <DataTable<ItemLinha>
          ariaLabel="Itens do pedido"
          data={itens}
          getRowId={(it) => it.id}
          columns={[
            { id: "referencia", header: "Referência", isRowHeader: true, render: (it) => <span className="font-medium text-primary">{it.referencia}</span> },
            { id: "descricao", header: "Descrição", render: (it) => it.descricao },
            { id: "pedida", header: "Pedida", render: (it) => it.quantidadePedida },
            { id: "faturada", header: "Faturada", render: (it) => it.quantidadeFaturada },
            { id: "status", header: "Status", render: (it) => <ItemStatusForm itemId={it.id} statusAtual={it.status} observacaoAtual={it.observacao} /> },
          ]}
        />
      </Tabs.Panel>

      <Tabs.Panel id="notas" className="pt-5">
        {notas.length === 0 ? (
          <div className="rounded-xl bg-secondary/50 p-8 text-center ring-1 ring-secondary">
            <p className="text-sm font-medium text-primary">Nenhuma NFe vinculada</p>
            <p className="mt-1 text-sm text-tertiary">As notas fiscais aparecem aqui quando forem conferidas.</p>
          </div>
        ) : (
          <DataTable<NotaLinha>
            ariaLabel="Notas fiscais do pedido"
            data={notas}
            getRowId={(n) => n.id}
            rowHref={(n) => `/conferencia/${n.id}`}
            columns={[
              { id: "numero", header: "Número", isRowHeader: true, render: (n) => <span className="font-medium text-primary">{n.numero}</span> },
              { id: "chave", header: "Chave de acesso", render: (n) => <span className="text-xs text-tertiary">{n.chaveAcesso}</span> },
              { id: "status", header: "Status", render: (n) => <StatusBadge tipo="nfe" valor={n.status} /> },
              { id: "cruz", header: "Cruzamento", render: () => <span className="text-sm font-semibold text-brand-secondary">Ver cruzamento</span> },
            ]}
          />
        )}
      </Tabs.Panel>

      <Tabs.Panel id="historico" className="pt-5">
        {timeline.length === 0 ? (
          <p className="text-sm text-tertiary">Nenhum evento registrado ainda.</p>
        ) : (
          <div className="rounded-xl bg-primary p-6 ring-1 ring-secondary">
            <Timeline eventos={timeline} />
          </div>
        )}
      </Tabs.Panel>
    </Tabs>
  );
}
