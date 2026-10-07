"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck } from "lucide-react";
import { analisarXmlNFe, confirmarBaixaNFe, type AnaliseNFe, type VinculosManuais } from "./actions";
import { executarConfirmacaoBaixa } from "./confirmar";
import { PageContainer } from "@/components/layouts/page-container";
import { PageHeader } from "@/components/patterns/page-header";
import { Botao } from "@/components/patterns/botao";
import { Selo } from "@/components/patterns/status-badge";
import { CampoSelect } from "@/components/patterns/campo";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/patterns/data-table";
import { formatarReais } from "@/domain/formato/moeda";

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

      <div className="flex max-w-2xl flex-col gap-4 rounded-lg border bg-card p-4">
        <div className="flex flex-col gap-2 rounded-lg border border-dashed p-6">
          <Input
            type="file"
            accept=".xml"
            aria-label="Arquivo XML da NFe"
            onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
          />
          <p className="text-xs text-muted-foreground">Apenas arquivos .xml</p>
        </div>
        {arquivo && (
          <p className="text-sm text-foreground/80">
            Selecionado: <span className="font-medium text-foreground">{arquivo.name}</span>
          </p>
        )}
        {erro && <p className="text-sm text-destructive">{erro}</p>}
        <div>
          <Botao variante="primario" disabled={!arquivo} carregando={analisando} onClick={() => handleAnalisar()}>
            Analisar
          </Botao>
        </div>
      </div>

      {analise && (
        <div className="flex flex-col gap-4">
          <div className="rounded-lg border bg-card p-4">
            <h2 className="text-sm font-semibold">NFe {analise.nfe.numero}</h2>
            <p className="mt-1 text-sm text-muted-foreground">Destinatário: {analise.nfe.destinatarioCnpj}</p>
            {!analise.fabricaId && (
              <p className="mt-2 text-sm text-destructive">A fábrica emitente desta NFe não está cadastrada no sistema.</p>
            )}
            {analise.fabricaId && !analise.clienteId && analise.candidatos.length === 0 && (
              <p className="mt-2 text-sm text-destructive">
                Nenhuma empresa tem o CNPJ {analise.nfe.destinatarioCnpj}, e nenhuma empresa sem CNPJ tem pedido aberto nesta fábrica.
              </p>
            )}
            {analise.fabricaId && !analise.clienteId && analise.candidatos.length > 0 && (
              <div className="mt-4 max-w-md">
                <CampoSelect
                  name="empresaDaNota"
                  rotulo="Para qual empresa é esta nota?"
                  dica={`Nenhuma empresa tem o CNPJ ${analise.nfe.destinatarioCnpj}. O CNPJ será gravado na empresa escolhida.`}
                  placeholder="Escolha a empresa…"
                  desabilitado={analisando}
                  aoMudar={(id) => id && handleAnalisar(id)}
                  opcoes={analise.candidatos.map((c) => {
                    const local = [c.cidade, c.uf].filter(Boolean).join("/");
                    return { id: c.id, label: local ? `${c.nome} — ${local}` : c.nome };
                  })}
                />
              </div>
            )}
            {analise.gravarCnpj && (
              <p className="mt-2 text-sm text-foreground/80">
                Ao confirmar, o CNPJ {analise.nfe.destinatarioCnpj} será gravado no cadastro da empresa.
              </p>
            )}
          </div>

          <DataTable<ConferenciaLinha>
            ariaLabel="Conferência de itens da NFe"
            data={linhas}
            getRowId={(r) => r._id}
            columns={[
              { id: "referencia", header: "Referência", isRowHeader: true, render: (r) => <span className="font-medium">{r.itemNFe.referencia}</span> },
              { id: "descricao", header: "Descrição", render: (r) => r.itemNFe.descricao },
              { id: "qtd", header: "Qtd. NFe", numerica: true, render: (r) => r.itemNFe.quantidade },
              { id: "valor", header: "Valor unit.", numerica: true, render: (r) => formatarReais(r.itemNFe.valorUnitario) },
              {
                id: "vinculo",
                header: "Baixa no pedido",
                render: (r) =>
                  analise?.clienteId ? (
                    <div className="min-w-64">
                      <CampoSelect
                        name={`vinculo-${r.indice}`}
                        placeholder="Sem item pendente"
                        desabilitado={analisando || enviando}
                        ariaLabel={`Item de pedido para ${r.itemNFe.referencia}`}
                        valor={r.pendencia?.itemPedidoId ?? NAO_BAIXAR}
                        aoMudar={(id) => id && trocarVinculo(r.indice, id)}
                        opcoes={opcoesVinculo}
                      />
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
                    <Selo cor="success">OK</Selo>
                  ) : (
                    <div className="flex flex-col gap-0.5">
                      {r.divergencias.map((d) => (
                        <span key={d} className="text-sm text-destructive">{d}</span>
                      ))}
                    </div>
                  ),
              },
            ]}
          />

          <div className="flex justify-end">
            <Botao variante="primario" icone={<CircleCheck />} carregando={enviando} disabled={cadastroIncompleto} onClick={handleConfirmar}>
              Confirmar baixa
            </Botao>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
