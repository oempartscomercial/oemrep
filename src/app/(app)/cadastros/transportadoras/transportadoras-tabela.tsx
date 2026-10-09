"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { DataTable } from "@/components/patterns/data-table";
import { Selo } from "@/components/patterns/status-badge";
import { Botao } from "@/components/patterns/botao";
import { CampoSelect, CampoTextarea, CampoTexto } from "@/components/patterns/campo";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { atualizarTransportadora, type DadosTransportadora } from "./actions";

export interface TransportadoraLinha {
  id: string;
  nome: string;
  cnpj: string;
  metodo: "SSW" | "MANUAL" | "NAO_MAPEADA";
  contato: string;
  urlPublica: string;
  observacao: string;
  emTransito: number;
  ultimaConsultaOk: string | null;
  issueUrl: string | null;
}

const METODO: Record<TransportadoraLinha["metodo"], { rotulo: string; cor: "success" | "gray" | "warning" }> = {
  SSW: { rotulo: "Automático (SSW)", cor: "success" },
  MANUAL: { rotulo: "Manual", cor: "gray" },
  NAO_MAPEADA: { rotulo: "Não mapeada", cor: "warning" },
};

const cnpjFormatado = (c: string) =>
  c.length === 14 ? `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12)}` : c;

export function TransportadorasTabela({ transportadoras }: { transportadoras: TransportadoraLinha[] }) {
  const router = useRouter();
  const [editando, setEditando] = useState<DadosTransportadora | null>(null);
  const [erros, setErros] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    if (!editando) return;
    setSalvando(true);
    const r = await atualizarTransportadora(editando);
    setSalvando(false);
    if (r.erros.length) return setErros(r.erros);
    toast.success(`${editando.nome} atualizada.`);
    setEditando(null);
    router.refresh();
  }

  return (
    <>
      <DataTable<TransportadoraLinha>
        ariaLabel="Transportadoras"
        data={transportadoras}
        getRowId={(t) => t.id}
        vazio="Nenhuma transportadora ainda. Elas aparecem aqui quando uma nota é conferida."
        columns={[
          {
            id: "nome",
            header: "Transportadora",
            isRowHeader: true,
            render: (t) => (
              <div className="flex flex-col">
                <span className="font-medium">{t.nome}</span>
                <span className="text-xs text-muted-foreground">{cnpjFormatado(t.cnpj)}</span>
              </div>
            ),
          },
          {
            id: "metodo",
            header: "Rastreio",
            render: (t) => (
              <div className="flex flex-col items-start gap-0.5">
                <Selo cor={METODO[t.metodo].cor}>{METODO[t.metodo].rotulo}</Selo>
                {t.issueUrl && (
                  <a href={t.issueUrl} target="_blank" rel="noreferrer" className="text-xs underline underline-offset-4">
                    pedido de integração
                  </a>
                )}
              </div>
            ),
          },
          { id: "transito", header: "Em trânsito", numerica: true, render: (t) => t.emTransito },
          { id: "consulta", header: "Última consulta ok", classe: "hidden md:table-cell", render: (t) => t.ultimaConsultaOk ?? <span className="text-muted-foreground">—</span> },
          { id: "contato", header: "Contato", classe: "hidden lg:table-cell", render: (t) => t.contato || <span className="text-muted-foreground">—</span> },
          {
            id: "acoes",
            header: <span className="sr-only">Ações</span>,
            render: (t) => (
              <Botao
                size="sm"
                variante="ghost"
                className="h-11 md:h-7"
                onClick={() => {
                  setErros([]);
                  setEditando({ id: t.id, nome: t.nome, metodo: t.metodo, contato: t.contato, urlPublica: t.urlPublica, observacao: t.observacao });
                }}
              >
                Editar
              </Botao>
            ),
          },
        ]}
      />

      {editando && (
        <Dialog open onOpenChange={(aberto) => !aberto && setEditando(null)}>
          <DialogContent className="sm:max-w-lg max-md:max-h-[calc(100dvh-2rem)] max-md:overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editando.nome}</DialogTitle>
              <DialogDescription>Como o sistema acompanha as notas desta transportadora.</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4">
              <CampoTexto rotulo="Nome" obrigatorio value={editando.nome} onChange={(e) => setEditando({ ...editando, nome: e.target.value })} />
              <CampoSelect
                rotulo="Rastreio"
                valor={editando.metodo}
                aoMudar={(v) => setEditando({ ...editando, metodo: v as DadosTransportadora["metodo"] })}
                opcoes={[
                  { id: "SSW", label: "Automático pelo SSW (consulta pela chave da nota)" },
                  { id: "MANUAL", label: "Manual (sem rastreio público; atualizo eu)" },
                  { id: "NAO_MAPEADA", label: "Não mapeada (tentar de novo / pedir integração)" },
                ]}
              />
              <CampoTexto
                rotulo="Contato"
                placeholder="WhatsApp ou telefone para perguntar das notas"
                value={editando.contato}
                onChange={(e) => setEditando({ ...editando, contato: e.target.value })}
              />
              <CampoTexto rotulo="Site de rastreio" placeholder="https://" value={editando.urlPublica} onChange={(e) => setEditando({ ...editando, urlPublica: e.target.value })} />
              <CampoTextarea rotulo="Observação" rows={2} value={editando.observacao} onChange={(e) => setEditando({ ...editando, observacao: e.target.value })} />
              {erros.map((e) => (
                <p key={e} role="alert" className="text-sm text-destructive">{e}</p>
              ))}
            </div>
            <DialogFooter>
              <Botao variante="ghost" className="h-11 md:h-8" onClick={() => setEditando(null)}>Cancelar</Botao>
              <Botao variante="primario" className="h-11 md:h-8" carregando={salvando} onClick={salvar}>Salvar</Botao>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
