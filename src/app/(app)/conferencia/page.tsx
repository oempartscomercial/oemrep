"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle } from "@untitledui/icons";
import { analisarXmlNFe, confirmarBaixaNFe, type AnaliseNFe } from "./actions";
import { PageContainer } from "@/components/layouts/page-container";
import { PageHeader } from "@/components/patterns/page-header";
import { Button } from "@/components/ui/buttons/button";
import { Badge } from "@/components/ui/badges/badges";
import { FileUploadDropZone } from "@/components/application/file-upload/file-upload-base";
import { DataTable } from "@/components/patterns/data-table";

type ConferenciaLinha = AnaliseNFe["conferencia"][number] & { _id: string };

export default function ConferenciaNFePage() {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [analisando, setAnalisando] = useState(false);
  const [analise, setAnalise] = useState<AnaliseNFe | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function handleAnalisar() {
    if (!arquivo) return;
    setErro(null);
    setAnalise(null);
    setAnalisando(true);
    const formData = new FormData();
    formData.append("arquivo", arquivo);
    const resultado = await analisarXmlNFe(formData);
    setAnalisando(false);
    if (resultado.erro) {
      setErro(resultado.erro);
      return;
    }
    setAnalise(resultado.analise ?? null);
  }

  async function handleConfirmar() {
    if (!analise) return;
    setEnviando(true);
    const resultado = await confirmarBaixaNFe(analise);
    setEnviando(false);
    if (resultado.erros.length > 0) {
      setErro(resultado.erros.join(" "));
      return;
    }
    router.push("/pedidos");
  }

  const cadastroIncompleto = analise ? !analise.clienteId || !analise.fabricaId : false;
  const linhas: ConferenciaLinha[] = (analise?.conferencia ?? []).map((r, i) => ({ ...r, _id: `${r.itemNFe.referencia}-${i}` }));

  return (
    <PageContainer>
      <PageHeader titulo="Conferência de NFe" descricao="Envie o XML da nota, revise as divergências e confirme a baixa." />

      <div className="flex max-w-2xl flex-col gap-4 rounded-xl bg-primary p-6 ring-1 ring-secondary">
        <FileUploadDropZone
          accept=".xml"
          allowsMultiple={false}
          hint="Apenas arquivos .xml"
          onDropFiles={(files) => setArquivo(files[0] ?? null)}
        />
        {arquivo && <p className="text-sm text-secondary">Selecionado: <span className="font-medium text-primary">{arquivo.name}</span></p>}
        {erro && <p className="text-sm text-error-primary">{erro}</p>}
        <div>
          <Button color="primary" isDisabled={!arquivo} isLoading={analisando} onClick={handleAnalisar}>
            Analisar
          </Button>
        </div>
      </div>

      {analise && (
        <div className="flex flex-col gap-4">
          <div className="rounded-xl bg-primary p-5 ring-1 ring-secondary">
            <h2 className="text-lg font-semibold text-primary">NFe {analise.nfe.numero}</h2>
            <p className="mt-1 text-sm text-tertiary">Destinatário: {analise.nfe.destinatarioCnpj}</p>
            {cadastroIncompleto && (
              <p className="mt-2 text-sm text-error-primary">Fábrica ou cliente desta NFe não está cadastrado no sistema.</p>
            )}
          </div>

          <DataTable<ConferenciaLinha>
            ariaLabel="Conferência de itens da NFe"
            data={linhas}
            getRowId={(r) => r._id}
            columns={[
              { id: "referencia", header: "Referência", isRowHeader: true, render: (r) => <span className="font-medium text-primary">{r.itemNFe.referencia}</span> },
              { id: "descricao", header: "Descrição", render: (r) => r.itemNFe.descricao },
              { id: "qtd", header: "Qtd. NFe", render: (r) => r.itemNFe.quantidade },
              { id: "valor", header: "Valor unit.", render: (r) => `R$ ${r.itemNFe.valorUnitario.toFixed(2)}` },
              {
                id: "diverg",
                header: "Divergências",
                render: (r) =>
                  r.divergencias.length === 0 ? (
                    <Badge color="success" type="pill-color" size="sm">OK</Badge>
                  ) : (
                    <div className="flex flex-col gap-0.5">
                      {r.divergencias.map((d) => (
                        <span key={d} className="text-sm text-error-primary">{d}</span>
                      ))}
                    </div>
                  ),
              },
            ]}
          />

          <div className="flex justify-end">
            <Button color="primary" iconLeading={CheckCircle} isLoading={enviando} isDisabled={cadastroIncompleto} onClick={handleConfirmar}>
              Confirmar baixa
            </Button>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
