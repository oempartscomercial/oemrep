"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { analisarPlanilha, confirmarImportacao } from "./actions";
import type { ItemExtraido } from "@/domain/importacao/excel";
import { PageContainer } from "@/components/layouts/page-container";
import { PageHeader } from "@/components/patterns/page-header";
import { Button } from "@/components/ui/buttons/button";
import { Input } from "@/components/ui/input/input";
import { Select } from "@/components/ui/select/select";
import { Checkbox } from "@/components/ui/checkbox/checkbox";
import { FileUploadDropZone } from "@/components/application/file-upload/file-upload-base";
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
    const resultado = await confirmarImportacao({ fabricaId, clienteId, numero, semNumero, itens });
    if (resultado.erros.length > 0) {
      setErro(resultado.erros.join(" "));
      return;
    }
    router.push("/pedidos");
  }

  const linhas: ItemLinha[] = (itens ?? []).map((it, i) => ({ ...it, _id: String(i) }));

  return (
    <PageContainer>
      <PageHeader titulo="Importar pedido (Excel)" descricao="Envie a planilha, revise os itens e confirme a criação." />

      {!itens && (
        <div className="flex max-w-2xl flex-col gap-4 rounded-xl bg-primary p-6 ring-1 ring-secondary">
          <FileUploadDropZone
            accept=".xlsx"
            allowsMultiple={false}
            hint="Apenas arquivos .xlsx"
            onDropFiles={(files) => setArquivo(files[0] ?? null)}
          />
          {arquivo && <p className="text-sm text-secondary">Selecionado: <span className="font-medium text-primary">{arquivo.name}</span></p>}
          {erro && <p className="text-sm text-error-primary">{erro}</p>}
          <div>
            <Button color="primary" isDisabled={!arquivo} isLoading={analisando} onClick={handleAnalisar}>
              Analisar planilha
            </Button>
          </div>
        </div>
      )}

      {itens && (
        <div className="flex flex-col gap-6">
          <div className="flex max-w-2xl flex-col gap-5 rounded-xl bg-primary p-6 ring-1 ring-secondary">
            <div className="grid gap-5 sm:grid-cols-2">
              <Select
                label="Fábrica"
                placeholder="Selecione…"
                selectedKey={fabricaId || null}
                onSelectionChange={(key) => setFabricaId(key ? String(key) : "")}
                items={fabricas.map((f) => ({ id: f.id, label: f.nome }))}
              >
                {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
              </Select>
              <Select
                label="Cliente"
                placeholder={fabricaId ? "Selecione…" : "Escolha a fábrica primeiro"}
                isDisabled={!fabricaId}
                selectedKey={clienteId || null}
                onSelectionChange={(key) => setClienteId(key ? String(key) : "")}
                items={clientes.map((c) => ({ id: c.id, label: c.nomeFantasia }))}
              >
                {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
              </Select>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <Input label="Número do pedido" placeholder="Ex.: PED-1001" value={numero} onChange={setNumero} isDisabled={semNumero} className="sm:max-w-xs" />
              <div className="pb-2.5">
                <Checkbox isSelected={semNumero} onChange={setSemNumero} label="S/N (sem número)" />
              </div>
            </div>
          </div>

          <DataTable<ItemLinha>
            ariaLabel="Itens extraídos da planilha"
            titulo="Itens da planilha"
            contadorBadge={`${linhas.length} itens`}
            data={linhas}
            getRowId={(it) => it._id}
            columns={[
              { id: "referencia", header: "Referência", isRowHeader: true, render: (it) => <span className="font-medium text-primary">{it.referencia}</span> },
              { id: "descricao", header: "Descrição", render: (it) => it.descricao },
              { id: "quantidade", header: "Qtd", render: (it) => it.quantidade },
              { id: "valor", header: "Valor unit.", render: (it) => it.valorUnitario },
            ]}
          />

          {erro && <p className="text-sm text-error-primary">{erro}</p>}
          <div className="flex justify-end gap-3">
            <Button color="secondary" onClick={() => { setItens(null); setArquivo(null); }}>Escolher outro arquivo</Button>
            <Button color="primary" onClick={handleConfirmar}>Confirmar importação</Button>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
