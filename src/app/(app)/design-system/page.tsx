"use client";

import { useState } from "react";
import { Plus, Trash01 } from "@untitledui/icons";
import { PageContainer } from "@/components/layouts/page-container";
import { PageHeader } from "@/components/patterns/page-header";
import { StatusBadge } from "@/components/patterns/status-badge";
import { DataTable } from "@/components/patterns/data-table";
import { FormField } from "@/components/patterns/form-field";
import { Timeline } from "@/components/patterns/timeline";
import { Button } from "@/components/ui/buttons/button";
import { Input } from "@/components/ui/input/input";
import { TextArea } from "@/components/ui/textarea/textarea";
import { Checkbox } from "@/components/ui/checkbox/checkbox";
import { Select } from "@/components/ui/select/select";
import { Badge } from "@/components/ui/badges/badges";

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-primary">{titulo}</h2>
      <div className="rounded-xl bg-primary p-6 ring-1 ring-secondary">{children}</div>
    </section>
  );
}

const SWATCHES: { nome: string; classe: string }[] = [
  { nome: "brand-600 (primária)", classe: "bg-brand-600" },
  { nome: "brand-800", classe: "bg-brand-800" },
  { nome: "brand-950", classe: "bg-brand-950" },
  { nome: "gray-300", classe: "bg-quaternary" },
  { nome: "red-600 (marca/alerta)", classe: "bg-error-solid" },
  { nome: "success-600", classe: "bg-success-solid" },
  { nome: "warning-600", classe: "bg-warning-solid" },
];

const PEDIDOS = [
  { id: "1", numero: "PED-1001", cliente: "Auto Peças Silva", situacao: "COMPLETO", valor: "R$ 12.400,00" },
  { id: "2", numero: "PED-1002", cliente: "Mecânica Central", situacao: "PARCIAL", valor: "R$ 3.980,00" },
  { id: "3", numero: "S/N", cliente: "Distribuidora Norte", situacao: "SEM_NFE", valor: "R$ 7.220,00" },
];

export default function DesignSystemPage() {
  const [aberto, setAberto] = useState(false);

  return (
    <PageContainer>
      <PageHeader
        titulo="Design System"
        descricao="Catálogo vivo do Untitled UI aplicado à OEM Representações (grafite + vermelho, tema claro)."
        acoes={<Button color="primary" iconLeading={Plus}>Ação primária</Button>}
      />

      <Secao titulo="Cores">
        <div className="flex flex-wrap gap-4">
          {SWATCHES.map((s) => (
            <div key={s.nome} className="flex flex-col items-center gap-2">
              <div className={`size-16 rounded-lg ring-1 ring-secondary ${s.classe}`} />
              <span className="text-xs text-tertiary">{s.nome}</span>
            </div>
          ))}
        </div>
      </Secao>

      <Secao titulo="Tipografia (Inter)">
        <div className="flex flex-col gap-2">
          <p className="text-display-md font-semibold text-primary">Display MD</p>
          <p className="text-display-sm font-semibold text-primary">Display SM</p>
          <p className="text-xl font-semibold text-primary">Texto XL</p>
          <p className="text-md text-secondary">Texto MD — corpo padrão do sistema.</p>
          <p className="text-sm text-tertiary">Texto SM — apoio e legendas.</p>
        </div>
      </Secao>

      <Secao titulo="Botões">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button color="primary">Primário</Button>
            <Button color="secondary">Secundário</Button>
            <Button color="tertiary">Terciário</Button>
            <Button color="link-color">Link</Button>
            <Button color="primary-destructive" iconLeading={Trash01}>Excluir</Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button color="primary" size="sm">Pequeno</Button>
            <Button color="primary" size="md">Médio</Button>
            <Button color="primary" size="lg">Grande</Button>
            <Button color="primary" isLoading>Carregando</Button>
            <Button color="primary" isDisabled>Desabilitado</Button>
          </div>
        </div>
      </Secao>

      <Secao titulo="Formulários">
        <div className="grid gap-5 sm:grid-cols-2">
          <Input label="Número do pedido" placeholder="PED-0000" />
          <Select label="Fábrica" placeholder="Selecione">
            <Select.Item id="bowden">Bowden</Select.Item>
            <Select.Item id="autoflex">Autoflex</Select.Item>
          </Select>
          <FormField label="Campo com erro" erro="Este campo é obrigatório.">
            <Input isInvalid placeholder="Valor inválido" />
          </FormField>
          <div className="flex flex-col gap-3">
            <TextArea label="Observação" placeholder="Escreva uma observação…" />
            <Checkbox label="Permitir acesso à fábrica" />
          </div>
        </div>
      </Secao>

      <Secao titulo="Badges de status (domínio)">
        <div className="flex flex-wrap gap-2">
          <StatusBadge tipo="pedido" valor="SEM_NFE" />
          <StatusBadge tipo="pedido" valor="PARCIAL" />
          <StatusBadge tipo="pedido" valor="COMPLETO" />
          <StatusBadge tipo="pedido" valor="ARQUIVADO" />
          <StatusBadge tipo="nfe" valor="TRANSITO" />
          <StatusBadge tipo="nfe" valor="RECEBIDA" />
          <StatusBadge tipo="nfe" valor="ARMAZENADA" />
          <StatusBadge tipo="nfe" valor="EXTRAVIADO" />
          <Badge color="brand" type="pill-color">Badge marca</Badge>
        </div>
      </Secao>

      <Secao titulo="Tabela">
        <DataTable
          ariaLabel="Pedidos de exemplo"
          titulo="Pedidos"
          contadorBadge={`${PEDIDOS.length} itens`}
          data={PEDIDOS}
          getRowId={(p) => p.id}
          columns={[
            { id: "numero", header: "Número", isRowHeader: true, render: (p) => <span className="font-medium text-primary">{p.numero}</span> },
            { id: "cliente", header: "Cliente", render: (p) => p.cliente },
            { id: "situacao", header: "Situação", render: (p) => <StatusBadge tipo="pedido" valor={p.situacao} /> },
            { id: "valor", header: "Valor", render: (p) => p.valor },
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

      <Secao titulo="Modal">
        <Button color="secondary" onClick={() => setAberto(true)}>Abrir modal</Button>
        {aberto && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay/70 p-4" onClick={() => setAberto(false)}>
            <div className="w-full max-w-md rounded-xl bg-primary p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-semibold text-primary">Confirmar ação</h3>
              <p className="mt-1 text-sm text-tertiary">Exemplo de diálogo. Substituir pelo componente Modal do Untitled nas telas reais.</p>
              <div className="mt-5 flex justify-end gap-3">
                <Button color="secondary" onClick={() => setAberto(false)}>Cancelar</Button>
                <Button color="primary" onClick={() => setAberto(false)}>Confirmar</Button>
              </div>
            </div>
          </div>
        )}
      </Secao>
    </PageContainer>
  );
}
