"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { analisarHistorico, confirmarImportacaoHistorico } from "./actions";
import type { LinhaHistorico } from "@/domain/historico/resolucao";
import { Button } from "@/components/ui/buttons/button";
import { FileUploadDropZone } from "@/components/application/file-upload/file-upload-base";
import { DataTable } from "@/components/patterns/data-table";

const MESES = ["", "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

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
        <div className="flex max-w-2xl flex-col gap-5 rounded-xl bg-primary p-6 ring-1 ring-secondary">
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-primary">Planilha de pedidos recebidos</p>
            <FileUploadDropZone accept=".xlsx" allowsMultiple={false} hint="Apenas .xlsx" onDropFiles={(f) => setPedidosFile(f[0] ?? null)} />
            {pedidosFile && <p className="text-sm text-secondary">Selecionado: <span className="font-medium text-primary">{pedidosFile.name}</span></p>}
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-primary">Planilha de NFes emitidas</p>
            <FileUploadDropZone accept=".xlsx" allowsMultiple={false} hint="Apenas .xlsx" onDropFiles={(f) => setNfeFile(f[0] ?? null)} />
            {nfeFile && <p className="text-sm text-secondary">Selecionado: <span className="font-medium text-primary">{nfeFile.name}</span></p>}
          </div>
          {erro && <p className="text-sm text-error-primary">{erro}</p>}
          <div>
            <Button color="primary" isDisabled={!pedidosFile && !nfeFile} isLoading={analisando} onClick={handleAnalisar}>
              Analisar planilhas
            </Button>
          </div>
        </div>
      )}

      {linhas && (
        <div className="flex flex-col gap-6">
          {temPendencia && (
            <div className="flex flex-col gap-2 rounded-xl bg-primary p-5 ring-1 ring-error-primary">
              <p className="text-sm font-medium text-error-primary">Fábricas não cadastradas — cadastre-as antes de importar:</p>
              <ul className="list-inside list-disc text-sm text-secondary">
                {pendencias.map((nome) => <li key={nome}>{nome}</li>)}
              </ul>
              <Link href="/cadastros" className="text-sm text-brand-secondary hover:underline">Ir para Cadastros</Link>
            </div>
          )}

          <DataTable<LinhaView>
            ariaLabel="Totais mensais a importar"
            titulo="Totais mensais"
            contadorBadge={`${view.length} linhas`}
            data={view}
            getRowId={(l) => l._id}
            columns={[
              { id: "periodo", header: "Período", isRowHeader: true, render: (l) => <span className="font-medium text-primary">{MESES[l.mes]}/{l.ano}</span> },
              { id: "fabrica", header: "Fábrica", render: (l) => l.fabricaNome },
              { id: "tipo", header: "Tipo", render: (l) => (l.tipo === "PEDIDO" ? "Pedidos" : "NFes") },
              { id: "valor", header: "Valor", render: (l) => brl(l.valor) },
            ]}
          />

          {erro && <p className="text-sm text-error-primary">{erro}</p>}
          <div className="flex justify-end gap-3">
            <Button color="secondary" onClick={() => { setLinhas(null); setPendencias([]); }}>Escolher outros arquivos</Button>
            <Button color="primary" isDisabled={temPendencia || view.length === 0} isLoading={confirmando} onClick={handleConfirmar}>
              Confirmar importação
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
