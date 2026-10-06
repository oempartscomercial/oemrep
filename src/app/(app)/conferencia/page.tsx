"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle } from "@untitledui/icons";
import { analisarXmlNFe, confirmarBaixaNFe, type AnaliseNFe, type VinculosManuais } from "./actions";
import { executarConfirmacaoBaixa } from "./confirmar";
import { PageContainer } from "@/components/layouts/page-container";
import { PageHeader } from "@/components/patterns/page-header";
import { Button } from "@/components/ui/buttons/button";
import { Badge } from "@/components/ui/badges/badges";
import { Select } from "@/components/ui/select/select";
import { FileUploadDropZone } from "@/components/application/file-upload/file-upload-base";
import { DataTable } from "@/components/patterns/data-table";

type ConferenciaLinha = AnaliseNFe["conferencia"][number] & { _id: string; indice: number };

const NAO_BAIXAR = "__nao-baixar";

export default function ConferenciaNFePage() {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [analisando, setAnalisando] = useState(false);
  const [analise, setAnalise] = useState<AnaliseNFe | null>(null);
  const [enviando, setEnviando] = useState(false);
  // Vínculos trocados à mão (RF16). O servidor recalcula as divergências a cada troca.
  const [vinculos, setVinculos] = useState<VinculosManuais>({});

  async function handleAnalisar(clienteId?: string, novosVinculos: VinculosManuais = {}) {
    if (!arquivo) return;
    setErro(null);
    if (!clienteId) setAnalise(null);
    setAnalisando(true);
    const formData = new FormData();
    formData.append("arquivo", arquivo);
    if (clienteId) formData.append("clienteId", clienteId);
    formData.append("vinculos", JSON.stringify(novosVinculos));
    const resultado = await analisarXmlNFe(formData);
    setAnalisando(false);
    if (resultado.erro) {
      setErro(resultado.erro);
      return;
    }
    setVinculos(novosVinculos);
    setAnalise(resultado.analise ?? null);
  }

  function trocarVinculo(indice: number, chave: string) {
    if (!analise) return;
    const novos = { ...vinculos, [indice]: chave === NAO_BAIXAR ? null : chave };
    handleAnalisar(analise.clienteId ?? undefined, novos);
  }

  async function handleConfirmar() {
    if (!analise) return;
    setEnviando(true);
    const mensagem = await executarConfirmacaoBaixa(() => confirmarBaixaNFe({ xml: analise.xml, clienteId: analise.clienteId, vinculos }));
    setEnviando(false);
    if (mensagem) {
      setErro(mensagem);
      return;
    }
    router.push("/pedidos");
  }

  const cadastroIncompleto = analise ? !analise.clienteId || !analise.fabricaId : false;
  const linhas: ConferenciaLinha[] = (analise?.conferencia ?? []).map((r, i) => ({ ...r, _id: `${r.itemNFe.referencia}-${i}`, indice: i }));
  const opcoesVinculo = [
    ...(analise?.opcoes ?? []).map((o) => ({ id: o.itemPedidoId, label: o.rotulo })),
    { id: NAO_BAIXAR, label: "Não baixar este item" },
  ];

  return (
    <PageContainer>
      <PageHeader
        titulo="Conferência de NFe"
        descricao="Envie o XML da nota, revise os vínculos com os pedidos e as divergências, e confirme a baixa."
      />

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
          <Button color="primary" isDisabled={!arquivo} isLoading={analisando} onClick={() => handleAnalisar()}>
            Analisar
          </Button>
        </div>
      </div>

      {analise && (
        <div className="flex flex-col gap-4">
          <div className="rounded-xl bg-primary p-5 ring-1 ring-secondary">
            <h2 className="text-lg font-semibold text-primary">NFe {analise.nfe.numero}</h2>
            <p className="mt-1 text-sm text-tertiary">Destinatário: {analise.nfe.destinatarioCnpj}</p>
            {!analise.fabricaId && (
              <p className="mt-2 text-sm text-error-primary">A fábrica emitente desta NFe não está cadastrada no sistema.</p>
            )}
            {analise.fabricaId && !analise.clienteId && analise.candidatos.length === 0 && (
              <p className="mt-2 text-sm text-error-primary">
                Nenhuma empresa tem o CNPJ {analise.nfe.destinatarioCnpj}, e nenhuma empresa sem CNPJ tem pedido aberto nesta fábrica.
              </p>
            )}
            {analise.fabricaId && !analise.clienteId && analise.candidatos.length > 0 && (
              <div className="mt-4 max-w-md">
                <Select
                  label="Para qual empresa é esta nota?"
                  hint={`Nenhuma empresa tem o CNPJ ${analise.nfe.destinatarioCnpj}. O CNPJ será gravado na empresa escolhida.`}
                  placeholder="Escolha a empresa…"
                  isDisabled={analisando}
                  onSelectionChange={(key) => key && handleAnalisar(String(key))}
                  items={analise.candidatos.map((c) => ({
                    id: c.id,
                    label: c.nome,
                    supportingText: [c.cidade, c.uf].filter(Boolean).join("/") || undefined,
                  }))}
                >
                  {(item) => <Select.Item id={item.id} supportingText={item.supportingText}>{item.label}</Select.Item>}
                </Select>
              </div>
            )}
            {analise.gravarCnpj && (
              <p className="mt-2 text-sm text-secondary">
                Ao confirmar, o CNPJ {analise.nfe.destinatarioCnpj} será gravado no cadastro da empresa.
              </p>
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
                id: "vinculo",
                header: "Baixa no pedido",
                render: (r) =>
                  analise?.clienteId ? (
                    <div className="min-w-64">
                      <Select
                        aria-label={`Item de pedido para ${r.itemNFe.referencia}`}
                        size="sm"
                        placeholder="Sem item pendente"
                        isDisabled={analisando || enviando}
                        selectedKey={r.pendencia?.itemPedidoId ?? NAO_BAIXAR}
                        onSelectionChange={(key) => key && trocarVinculo(r.indice, String(key))}
                        items={opcoesVinculo}
                      >
                        {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
                      </Select>
                    </div>
                  ) : (
                    "—"
                  ),
              },
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
