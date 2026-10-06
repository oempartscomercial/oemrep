"use client";

import type { ReactNode } from "react";
import { Plus, Trash2 } from "lucide-react";
import { PageContainer } from "@/components/layouts/page-container";
import { PageHeader } from "@/components/patterns/page-header";
import { Botao } from "@/components/patterns/botao";
import { CampoCheckbox, CampoSelect, CampoTexto, CampoTextarea } from "@/components/patterns/campo";
import { Selo, StatusBadge } from "@/components/patterns/status-badge";
import { DataTable } from "@/components/patterns/data-table";
import { Timeline } from "@/components/patterns/timeline";

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold">{titulo}</h2>
      <div className="rounded-lg border bg-card p-4">{children}</div>
    </section>
  );
}

const PEDIDOS = [
  { id: "1", numero: "PED-1001", cliente: "Auto Peças Silva", situacao: "COMPLETO", valor: "R$ 12.400,00" },
  { id: "2", numero: "PED-1002", cliente: "Mecânica Central", situacao: "PARCIAL", valor: "R$ 3.980,00" },
  { id: "3", numero: "S/N", cliente: "Distribuidora Norte", situacao: "SEM_NFE", valor: "R$ 7.220,00" },
];

export default function DesignSystemPage() {
  return (
    <PageContainer>
      <PageHeader
        titulo="Design System"
        descricao="Catálogo curto dos componentes do app (shadcn/ui, visual denso e neutro)."
        acoes={<Botao variante="primario" icone={<Plus />}>Ação primária</Botao>}
      />

      <Secao titulo="Botões">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Botao variante="primario">Primário</Botao>
            <Botao variante="secundario">Secundário</Botao>
            <Botao variante="ghost">Ghost</Botao>
            <Botao variante="destrutivo" icone={<Trash2 />}>Excluir</Botao>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Botao variante="primario" size="sm">Pequeno</Botao>
            <Botao variante="primario">Padrão</Botao>
            <Botao variante="primario" carregando>Carregando</Botao>
            <Botao variante="primario" disabled>Desabilitado</Botao>
          </div>
        </div>
      </Secao>

      <Secao titulo="Campos">
        <div className="grid gap-4 sm:grid-cols-2">
          <CampoTexto rotulo="Número do pedido" placeholder="PED-0000" dica="Como aparece no pedido da fábrica." />
          <CampoSelect
            rotulo="Fábrica"
            opcoes={[
              { id: "bowden", label: "Bowden" },
              { id: "autoflex", label: "Autoflex" },
            ]}
          />
          <CampoTexto rotulo="Campo com erro" erro="Este campo é obrigatório." placeholder="Valor inválido" />
          <div className="flex flex-col gap-3">
            <CampoTextarea rotulo="Observação" placeholder="Escreva uma observação…" />
            <CampoCheckbox rotulo="Permitir acesso à fábrica" dica="O usuário verá só os pedidos dela." />
          </div>
        </div>
      </Secao>

      <Secao titulo="Selos">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <StatusBadge tipo="pedido" valor="SEM_NFE" />
            <StatusBadge tipo="pedido" valor="PARCIAL" />
            <StatusBadge tipo="pedido" valor="COMPLETO" />
            <StatusBadge tipo="pedido" valor="ARQUIVADO" />
            <StatusBadge tipo="nfe" valor="TRANSITO" />
            <StatusBadge tipo="nfe" valor="RECEBIDA" />
            <StatusBadge tipo="nfe" valor="EXTRAVIADO" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Selo cor="gray">Neutro</Selo>
            <Selo cor="success">Sucesso</Selo>
            <Selo cor="warning">Aviso</Selo>
            <Selo cor="error">Erro</Selo>
            <Selo cor="blue">Info</Selo>
          </div>
        </div>
      </Secao>

      <Secao titulo="Tabela">
        <DataTable
          ariaLabel="Pedidos de exemplo"
          titulo="Pedidos"
          data={PEDIDOS}
          getRowId={(p) => p.id}
          columns={[
            { id: "numero", header: "Número", isRowHeader: true, render: (p) => p.numero },
            { id: "cliente", header: "Cliente", render: (p) => p.cliente },
            { id: "situacao", header: "Situação", render: (p) => <StatusBadge tipo="pedido" valor={p.situacao} /> },
            { id: "valor", header: "Valor", numerica: true, render: (p) => p.valor },
          ]}
        />
      </Secao>

      <Secao titulo="Timeline (rastreio)">
        <Timeline
          eventos={[
            { id: "1", titulo: "Em trânsito", data: "10/07/2026", autor: "Ana", descricao: "NFe emitida pela fábrica." },
            { id: "2", titulo: "Recebida", data: "12/07/2026", autor: "Ana" },
            { id: "3", titulo: "Extraviado", data: "13/07/2026", autor: "Carlos", destaque: true, descricao: "Divergência aberta." },
          ]}
        />
      </Secao>
    </PageContainer>
  );
}
