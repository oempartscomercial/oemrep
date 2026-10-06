"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { analisarPlanilha, confirmarImportacao } from "./actions";
import { executarConfirmacao } from "./confirmar";
import type { ItemExtraido } from "@/domain/importacao/excel";
import { PageContainer } from "@/components/layouts/page-container";
import { PageHeader } from "@/components/patterns/page-header";
import { Botao } from "@/components/patterns/botao";
import { CampoCheckbox, CampoSelect, CampoTexto } from "@/components/patterns/campo";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/patterns/data-table";

type Fabrica = { id: string; nome: string };
type Cliente = { id: string; nomeFantasia: string };
type ItemLinha = ItemExtraido & { _id: string };

export default function ImportarPedidoPage() {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [analisando, setAnalisando] = useState(false);
  const [itens, setItens] = useState<ItemExtraido[] | null>(null);
  const [fabricas, setFabricas] = useState<Fabrica[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [fabricaId, setFabricaId] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [numero, setNumero] = useState("");
  const [semNumero, setSemNumero] = useState(false);

  useEffect(() => {
    fetch("/api/fabricas").then((r) => r.json()).then(setFabricas);
  }, []);

  useEffect(() => {
    if (!fabricaId) return;
    let ativo = true;
    fetch(`/api/clientes?fabricaId=${fabricaId}`)
      .then((r) => r.json())
      .then((d) => { if (ativo) setClientes(d); });
    return () => { ativo = false; };
  }, [fabricaId]);

  async function handleAnalisar() {
    if (!arquivo) return;
    setErro(null);
    setAnalisando(true);
    const formData = new FormData();
    formData.append("arquivo", arquivo);
    const resultado = await analisarPlanilha(formData);
    setAnalisando(false);
    if (resultado.erro) {
      setErro(resultado.erro);
      return;
    }
    setItens(resultado.itens ?? []);
  }

  async function handleConfirmar() {
    if (!itens) return;
    setErro(null);
    const mensagem = await executarConfirmacao(() =>
      confirmarImportacao({ fabricaId, clienteId, numero, semNumero, itens }),
    );
    if (mensagem) {
      setErro(mensagem);
      return;
    }
    router.push("/pedidos");
  }

  const linhas: ItemLinha[] = (itens ?? []).map((it, i) => ({ ...it, _id: String(i) }));

  return (
    <PageContainer>
      <PageHeader titulo="Importar pedido (Excel)" descricao="Envie a planilha, revise os itens e confirme a criação." />

      {!itens && (
        <div className="flex max-w-xl flex-col gap-4">
          <div className="rounded-lg border border-dashed p-6">
            <Input
              type="file"
              accept=".xlsx"
              aria-label="Planilha de pedido (.xlsx)"
              onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
            />
            <p className="mt-2 text-xs text-muted-foreground">Apenas arquivos .xlsx</p>
          </div>
          {arquivo && <p className="text-sm text-foreground/80">Selecionado: <span className="font-medium text-foreground">{arquivo.name}</span></p>}
          {erro && <p className="text-sm text-destructive">{erro}</p>}
          <div>
            <Botao variante="primario" type="button" disabled={!arquivo} carregando={analisando} onClick={handleAnalisar}>
              Analisar planilha
            </Botao>
          </div>
        </div>
      )}

      {itens && (
        <div className="flex flex-col gap-4">
          <div className="flex max-w-xl flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <CampoSelect
                rotulo="Fábrica"
                aoMudar={(valor) => { setFabricaId(valor); setClienteId(""); }}
                opcoes={fabricas.map((f) => ({ id: f.id, label: f.nome }))}
              />
              <CampoSelect
                key={fabricaId}
                rotulo="Cliente"
                placeholder={fabricaId ? "Selecione…" : "Escolha a fábrica primeiro"}
                desabilitado={!fabricaId}
                aoMudar={setClienteId}
                opcoes={clientes.map((c) => ({ id: c.id, label: c.nomeFantasia }))}
              />
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <CampoTexto
                rotulo="Número do pedido"
                placeholder="Ex.: PED-1001"
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
                disabled={semNumero}
                className="sm:max-w-xs sm:flex-1"
              />
              <div className="pb-1.5">
                <CampoCheckbox marcado={semNumero} aoMudar={setSemNumero} rotulo="S/N (sem número)" />
              </div>
            </div>
          </div>

          <DataTable<ItemLinha>
            ariaLabel="Itens extraídos da planilha"
            titulo="Itens da planilha"
            descricao={`${linhas.length} itens`}
            data={linhas}
            getRowId={(it) => it._id}
            columns={[
              { id: "referencia", header: "Referência", isRowHeader: true, render: (it) => <span className="font-medium text-foreground">{it.referencia}</span> },
              { id: "descricao", header: "Descrição", render: (it) => it.descricao },
              { id: "quantidade", header: "Qtd", numerica: true, render: (it) => it.quantidade },
              { id: "valor", header: "Valor unit.", numerica: true, render: (it) => it.valorUnitario },
            ]}
          />

          {erro && <p className="text-sm text-destructive">{erro}</p>}
          <div className="flex gap-2">
            <Botao variante="primario" type="button" onClick={handleConfirmar}>Confirmar importação</Botao>
            <Botao variante="secundario" type="button" onClick={() => { setItens(null); setArquivo(null); }}>Escolher outro arquivo</Botao>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
