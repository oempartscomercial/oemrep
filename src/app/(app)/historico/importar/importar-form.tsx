"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { analisarHistorico, confirmarImportacaoHistorico } from "./actions";
import type { LinhaHistorico } from "@/domain/historico/resolucao";
import { Botao } from "@/components/patterns/botao";
import { Campo } from "@/components/patterns/campo";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/patterns/data-table";
import { formatarReais } from "@/domain/formato/moeda";

const MESES = ["", "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const brl = formatarReais;

type LinhaView = LinhaHistorico & { _id: string };

export function ImportarHistoricoForm() {
  const router = useRouter();
  const [pedidosFile, setPedidosFile] = useState<File | null>(null);
  const [nfeFile, setNfeFile] = useState<File | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [analisando, setAnalisando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [linhas, setLinhas] = useState<LinhaHistorico[] | null>(null);
  const [pendencias, setPendencias] = useState<string[]>([]);

  async function handleAnalisar() {
    setErro(null);
    setAnalisando(true);
    const formData = new FormData();
    if (pedidosFile) formData.append("pedidos", pedidosFile);
    if (nfeFile) formData.append("nfe", nfeFile);
    const resultado = await analisarHistorico(formData);
    setAnalisando(false);
    if (resultado.erro) {
      setErro(resultado.erro);
      return;
    }
    setLinhas(resultado.linhas ?? []);
    setPendencias(resultado.pendencias ?? []);
  }

  async function handleConfirmar() {
    if (!linhas) return;
    setErro(null);
    setConfirmando(true);
    const resultado = await confirmarImportacaoHistorico(linhas);
    setConfirmando(false);
    if (resultado.erros.length > 0) {
      setErro(resultado.erros.join(" "));
      return;
    }
    router.push("/");
  }

  const view: LinhaView[] = (linhas ?? []).map((l, i) => ({ ...l, _id: String(i) }));
  const temPendencia = pendencias.length > 0;

  return (
    <>
      {!linhas && (
        <div className="flex max-w-xl flex-col gap-4">
          <Campo rotulo="Planilha de pedidos recebidos" htmlFor="planilha-pedidos" dica="Apenas .xlsx">
            <div className="rounded-lg border border-dashed p-6">
              <Input id="planilha-pedidos" type="file" accept=".xlsx" onChange={(e) => setPedidosFile(e.target.files?.[0] ?? null)} />
            </div>
            {pedidosFile && <p className="text-sm text-foreground/80">Selecionado: <span className="font-medium text-foreground">{pedidosFile.name}</span></p>}
          </Campo>
          <Campo rotulo="Planilha de NFes emitidas" htmlFor="planilha-nfe" dica="Apenas .xlsx">
            <div className="rounded-lg border border-dashed p-6">
              <Input id="planilha-nfe" type="file" accept=".xlsx" onChange={(e) => setNfeFile(e.target.files?.[0] ?? null)} />
            </div>
            {nfeFile && <p className="text-sm text-foreground/80">Selecionado: <span className="font-medium text-foreground">{nfeFile.name}</span></p>}
          </Campo>
          {erro && <p className="text-sm text-destructive">{erro}</p>}
          <div>
            <Botao type="button" variante="primario" disabled={!pedidosFile && !nfeFile} carregando={analisando} onClick={handleAnalisar}>
              Analisar planilhas
            </Botao>
          </div>
        </div>
      )}

      {linhas && (
        <div className="flex flex-col gap-4">
          {temPendencia && (
            <div className="flex flex-col gap-2 rounded-lg border border-destructive/40 bg-danger-soft p-4">
              <p className="text-sm font-medium text-destructive">Fábricas não cadastradas — cadastre-as antes de importar:</p>
              <ul className="list-inside list-disc text-sm text-foreground/80">
                {pendencias.map((nome) => <li key={nome}>{nome}</li>)}
              </ul>
              <Link href="/cadastros" className="text-sm underline-offset-4 hover:underline">Ir para Cadastros</Link>
            </div>
          )}

          <DataTable<LinhaView>
            ariaLabel="Totais mensais a importar"
            titulo="Totais mensais"
            descricao={`${view.length} linhas`}
            data={view}
            getRowId={(l) => l._id}
            columns={[
              { id: "periodo", header: "Período", isRowHeader: true, render: (l) => <span className="font-medium">{MESES[l.mes]}/{l.ano}</span> },
              { id: "fabrica", header: "Fábrica", render: (l) => l.fabricaNome },
              { id: "tipo", header: "Tipo", render: (l) => (l.tipo === "PEDIDO" ? "Pedidos" : "NFes") },
              { id: "valor", header: "Valor", numerica: true, render: (l) => brl(l.valor) },
            ]}
          />

          {erro && <p className="text-sm text-destructive">{erro}</p>}
          <div className="flex justify-end gap-2">
            <Botao type="button" variante="secundario" onClick={() => { setLinhas(null); setPendencias([]); }}>Escolher outros arquivos</Botao>
            <Botao type="button" variante="primario" disabled={temPendencia || view.length === 0} carregando={confirmando} onClick={handleConfirmar}>
              Confirmar importação
            </Botao>
          </div>
        </div>
      )}
    </>
  );
}
