"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  notas: { id: string; numero: string; quantidade: number }[];
}
export interface NotaLinha {
  id: string;
  numero: string;
  chaveAcesso: string;
  status: string;
}
export interface EventoLinha {
  id: string;
  titulo: string;
  de: string;
  para: string;
  autor: string;
  criadoEm: string;
}

export function PedidoDetalheTabs({ itens, notas, eventos }: { itens: ItemLinha[]; notas: NotaLinha[]; eventos: EventoLinha[] }) {
  const timeline: TimelineItem[] = eventos.map((ev) => ({
    id: ev.id,
    titulo: ev.titulo,
    descricao: `${ev.de} → ${ev.para}`,
    data: new Date(ev.criadoEm).toLocaleString("pt-BR"),
    autor: ev.autor,
  }));

  return (
    <Tabs defaultValue="itens" className="gap-4">
      <TabsList variant="line" className="w-full justify-start border-b">
        <TabsTrigger value="itens" className="flex-none">Itens</TabsTrigger>
        <TabsTrigger value="notas" className="flex-none">Notas fiscais</TabsTrigger>
        <TabsTrigger value="historico" className="flex-none">Histórico</TabsTrigger>
      </TabsList>

      <TabsContent value="itens">
        <DataTable<ItemLinha>
          ariaLabel="Itens do pedido"
          data={itens}
          getRowId={(it) => it.id}
          columns={[
            { id: "referencia", header: "Referência", isRowHeader: true, render: (it) => <span className="font-medium text-foreground">{it.referencia}</span> },
            { id: "descricao", header: "Descrição", render: (it) => it.descricao },
            { id: "pedida", header: "Pedida", numerica: true, render: (it) => it.quantidadePedida },
            { id: "faturada", header: "Faturada", numerica: true, render: (it) => it.quantidadeFaturada },
            {
              id: "notas",
              header: "Faturado nas notas",
              render: (it) =>
                it.notas.length === 0 ? (
                  <span className="text-muted-foreground">—</span>
                ) : (
                  <div className="flex flex-col gap-0.5">
                    {it.notas.map((n) => (
                      <a key={n.id} href={`/conferencia/${n.id}`} className="text-sm underline-offset-4 hover:underline">
                        NF {n.numero} ({n.quantidade})
                      </a>
                    ))}
                  </div>
                ),
            },
            { id: "status", header: "Status", render: (it) => <ItemStatusForm itemId={it.id} statusAtual={it.status} observacaoAtual={it.observacao} /> },
          ]}
        />
      </TabsContent>

      <TabsContent value="notas">
        {notas.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-muted/40 p-8 text-center">
            <p className="text-sm font-medium text-foreground">Nenhuma NFe vinculada</p>
            <p className="mt-1 text-sm text-muted-foreground">As notas fiscais aparecem aqui quando forem conferidas.</p>
          </div>
        ) : (
          <DataTable<NotaLinha>
            ariaLabel="Notas fiscais do pedido"
            data={notas}
            getRowId={(n) => n.id}
            rowHref={(n) => `/conferencia/${n.id}`}
            columns={[
              { id: "numero", header: "Número", isRowHeader: true, render: (n) => <span className="font-medium text-foreground">{n.numero}</span> },
              { id: "chave", header: "Chave de acesso", render: (n) => <span className="text-xs text-muted-foreground">{n.chaveAcesso}</span> },
              { id: "status", header: "Status", render: (n) => <StatusBadge tipo="nfe" valor={n.status} /> },
              { id: "cruz", header: "Cruzamento", render: () => <span className="text-sm font-medium">Ver cruzamento</span> },
            ]}
          />
        )}
      </TabsContent>

      <TabsContent value="historico">
        {timeline.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum evento registrado ainda.</p>
        ) : (
          <div className="rounded-lg border bg-card p-4">
            <Timeline eventos={timeline} />
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
