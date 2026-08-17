"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash01, AlertTriangle, CheckCircle } from "@untitledui/icons";
import { iniciarExtracaoPdf, confirmarImportacaoPdf, descartarRascunhoPdf, type RascunhoPdf } from "./actions";
import { numeroBr } from "@/domain/importacao/pdf";
import { formatarReais } from "@/domain/formato/moeda";
import { PageContainer } from "@/components/layouts/page-container";
import { PageHeader } from "@/components/patterns/page-header";
import { Button } from "@/components/ui/buttons/button";
import { Input } from "@/components/ui/input/input";
import { Select } from "@/components/ui/select/select";
import { Checkbox } from "@/components/ui/checkbox/checkbox";
import { FileUploadDropZone } from "@/components/application/file-upload/file-upload-base";

type Fabrica = { id: string; nome: string };
type Cliente = { id: string; nomeFantasia: string };

// Linha editável: quantidade e valor ficam como texto enquanto o operador digita; a
// conversão para número (com numeroBr) só acontece na hora de confirmar.
type LinhaEdicao = {
  referencia: string;
  descricao: string;
  quantidade: string;
  valorUnitario: string;
  problemas: string[];
};

function seedLinhas(rascunho: RascunhoPdf): LinhaEdicao[] {
  return rascunho.itens.map((it) => ({
    referencia: it.referencia,
    descricao: it.descricao,
    quantidade: it.quantidade === null ? "" : String(it.quantidade),
    valorUnitario: it.valorUnitario === null ? "" : String(it.valorUnitario).replace(".", ","),
    problemas: it.problemas,
  }));
}

export default function ImportarPdfPage() {
  const router = useRouter();
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [lendo, setLendo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [rascunho, setRascunho] = useState<RascunhoPdf | null>(null);
  const [linhas, setLinhas] = useState<LinhaEdicao[]>([]);
  const [fabricas, setFabricas] = useState<Fabrica[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [fabricaId, setFabricaId] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [numero, setNumero] = useState("");
  const [semNumero, setSemNumero] = useState(false);
  const [confirmando, setConfirmando] = useState(false);

  useEffect(() => {
    fetch("/api/fabricas").then((r) => r.json()).then(setFabricas).catch(() => {});
  }, []);

  useEffect(() => {
    if (!fabricaId) return;
    let ativo = true;
    fetch(`/api/clientes?fabricaId=${fabricaId}`)
      .then((r) => r.json())
      .then((d) => { if (ativo) setClientes(Array.isArray(d) ? d : []); })
      .catch(() => {});
    return () => { ativo = false; };
  }, [fabricaId]);

  async function handleLer() {
    if (!arquivo) return;
    setErro(null);
    setLendo(true);
    const formData = new FormData();
    formData.append("arquivo", arquivo);
    const resultado = await iniciarExtracaoPdf(formData);
    setLendo(false);
    if (resultado.erro || !resultado.rascunho) {
      setErro(resultado.erro ?? "Não foi possível ler o PDF.");
      return;
    }
    const r = resultado.rascunho;
    setRascunho(r);
    setLinhas(seedLinhas(r));
    setFabricaId(r.fabrica?.id ?? "");
    setClienteId(r.cliente?.id ?? "");
    setNumero(r.cabecalho.numeroPedido);
  }

  function atualizarLinha(i: number, campo: keyof LinhaEdicao, valor: string) {
    setLinhas((atual) => atual.map((l, idx) => (idx === i ? { ...l, [campo]: valor } : l)));
  }

  function removerLinha(i: number) {
    setLinhas((atual) => atual.filter((_, idx) => idx !== i));
  }

  function adicionarLinha() {
    setLinhas((atual) => [...atual, { referencia: "", descricao: "", quantidade: "", valorUnitario: "", problemas: [] }]);
  }

  async function handleConfirmar() {
    if (!rascunho) return;
    setErro(null);
    setConfirmando(true);
    const itens = linhas.map((l) => ({
      referencia: l.referencia.trim(),
      descricao: l.descricao.trim(),
      quantidade: numeroBr(l.quantidade) ?? NaN,
      valorUnitario: numeroBr(l.valorUnitario) ?? NaN,
    }));
    const resultado = await confirmarImportacaoPdf({
      importacaoId: rascunho.importacaoId,
      fabricaId,
      clienteId,
      numero,
      semNumero,
      itens,
    });
    setConfirmando(false);
    if (resultado.erros.length > 0) {
      setErro(resultado.erros.join(" "));
      return;
    }
    router.push("/pedidos");
  }

  async function handleDescartar() {
    if (rascunho) await descartarRascunhoPdf(rascunho.importacaoId);
    setRascunho(null);
    setLinhas([]);
    setArquivo(null);
  }

  const totalCalculado = linhas.reduce(
    (soma, l) => soma + (numeroBr(l.quantidade) ?? 0) * (numeroBr(l.valorUnitario) ?? 0),
    0,
  );

  return (
    <PageContainer>
      <PageHeader
        titulo="Importar pedido (PDF)"
        descricao="Envie o PDF do pedido, revise o que foi lido e confirme a criação."
      />

      {!rascunho && (
        <div className="flex max-w-2xl flex-col gap-4 rounded-xl bg-primary p-6 ring-1 ring-secondary">
          <FileUploadDropZone
            accept="application/pdf,.pdf"
            allowsMultiple={false}
            hint="Apenas arquivos .pdf"
            onDropFiles={(files) => setArquivo(files[0] ?? null)}
            onDropUnacceptedFiles={() => setErro("Esse arquivo não é um PDF. Envie o PDF do pedido.")}
          />
          {arquivo && <p className="text-sm text-secondary">Selecionado: <span className="font-medium text-primary">{arquivo.name}</span></p>}
          {erro && <p role="alert" className="text-sm text-error-primary">{erro}</p>}
          <p className="text-xs text-tertiary">
            Os itens são lidos do texto do PDF. Confira tudo na próxima tela antes de confirmar — PDF escaneado (foto) não tem texto para ler.
          </p>
          <div>
            <Button color="primary" isDisabled={!arquivo} isLoading={lendo} onClick={handleLer}>
              {lendo ? "Lendo o pedido…" : "Ler pedido"}
            </Button>
          </div>
        </div>
      )}

      {rascunho && (
        <div className="flex flex-col gap-6">
          {/* Conferência aritmética: a prova de que a leitura fechou com o próprio PDF. */}
          {rascunho.conferencia.confere ? (
            <div className="flex items-center gap-2 rounded-lg bg-success-primary/10 px-4 py-3 text-sm text-success-primary ring-1 ring-success-primary/20">
              <CheckCircle className="size-5 shrink-0" />
              <span>Os totais do PDF batem com o que foi lido ({rascunho.conferencia.itensLidos} itens · {formatarReais(totalCalculado)}). Confira e confirme.</span>
            </div>
          ) : (
            <div className="flex items-start gap-2 rounded-lg bg-warning-primary/10 px-4 py-3 text-sm text-warning-primary ring-1 ring-warning-primary/20">
              <AlertTriangle className="size-5 shrink-0" />
              <div>
                <p className="font-medium">Confira a leitura — os totais não fecharam sozinhos.</p>
                <ul className="mt-1 list-disc pl-5">
                  {!rascunho.conferencia.contagemConfere && rascunho.conferencia.itensDeclarados !== null && (
                    <li>O PDF diz {rascunho.conferencia.itensDeclarados} itens; foram lidos {rascunho.conferencia.itensLidos}.</li>
                  )}
                  {!rascunho.conferencia.somaQuantidadesConfere && rascunho.conferencia.somaQuantidadesDeclarada !== null && (
                    <li>Soma das quantidades: PDF diz {rascunho.conferencia.somaQuantidadesDeclarada}, leitura deu {rascunho.conferencia.somaQuantidadesLida}.</li>
                  )}
                  {!rascunho.conferencia.totalConfere && rascunho.conferencia.totalDeclarado !== null && (
                    <li>Total de produtos: PDF diz {formatarReais(rascunho.conferencia.totalDeclarado)}, a soma das linhas dá {formatarReais(totalCalculado)}.</li>
                  )}
                </ul>
              </div>
            </div>
          )}

          {/* Cabeçalho pré-preenchido pelo CNPJ do PDF, sempre editável. */}
          <div className="flex max-w-2xl flex-col gap-5 rounded-xl bg-primary p-6 ring-1 ring-secondary">
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <Select
                  label="Fábrica"
                  placeholder="Selecione…"
                  selectedKey={fabricaId || null}
                  onSelectionChange={(key) => setFabricaId(key ? String(key) : "")}
                  items={fabricas.map((f) => ({ id: f.id, label: f.nome }))}
                >
                  {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
                </Select>
                {!rascunho.fabrica && (
                  <p className="mt-1 text-xs text-warning-primary">CNPJ {rascunho.fabricaCnpj || "não lido"} não bateu com nenhuma fábrica cadastrada.</p>
                )}
              </div>
              <div>
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
                {!rascunho.cliente && (
                  <p className="mt-1 text-xs text-warning-primary">CNPJ {rascunho.clienteCnpj || "não lido"} não bateu com nenhum cliente cadastrado.</p>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <Input label="Número do pedido" placeholder="Ex.: 4103" value={numero} onChange={setNumero} isDisabled={semNumero} className="sm:max-w-xs" />
              <div className="pb-2.5">
                <Checkbox isSelected={semNumero} onChange={setSemNumero} label="S/N (sem número)" />
              </div>
            </div>
          </div>

          {/* Grade editável — o coração do fluxo: nada é gravado sem passar por aqui. */}
          <div className="overflow-x-auto rounded-xl bg-primary ring-1 ring-secondary">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-secondary text-left text-xs text-tertiary">
                  <th className="w-40 px-4 py-3 font-medium">Referência</th>
                  <th className="px-4 py-3 font-medium">Descrição</th>
                  <th className="w-24 px-4 py-3 font-medium">Qtd</th>
                  <th className="w-32 px-4 py-3 font-medium">Valor unit.</th>
                  <th className="w-10 px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l, i) => (
                  <tr key={i} className={`border-b border-secondary last:border-0 ${l.problemas.length > 0 ? "bg-warning-primary/5" : ""}`}>
                    <td className="px-4 py-2 align-top">
                      <Input aria-label={`Referência ${i + 1}`} value={l.referencia} onChange={(v) => atualizarLinha(i, "referencia", v)} />
                    </td>
                    <td className="px-4 py-2 align-top">
                      <Input aria-label={`Descrição ${i + 1}`} value={l.descricao} onChange={(v) => atualizarLinha(i, "descricao", v)} />
                      {l.problemas.length > 0 && (
                        <ul className="mt-1 list-disc pl-4 text-xs text-warning-primary">
                          {l.problemas.map((p, k) => <li key={k}>{p}</li>)}
                        </ul>
                      )}
                    </td>
                    <td className="px-4 py-2 align-top">
                      <Input aria-label={`Quantidade ${i + 1}`} value={l.quantidade} onChange={(v) => atualizarLinha(i, "quantidade", v)} />
                    </td>
                    <td className="px-4 py-2 align-top">
                      <Input aria-label={`Valor unitário ${i + 1}`} value={l.valorUnitario} onChange={(v) => atualizarLinha(i, "valorUnitario", v)} />
                    </td>
                    <td className="px-4 py-2 align-top">
                      <Button color="tertiary" size="sm" aria-label={`Remover linha ${i + 1}`} onClick={() => removerLinha(i)} iconLeading={<Trash01 />} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex items-center justify-between px-4 py-3">
              <Button color="link-color" size="sm" onClick={adicionarLinha} iconLeading={<Plus />}>Adicionar linha</Button>
              <span className="text-sm text-secondary">{linhas.length} itens · total {formatarReais(totalCalculado)}</span>
            </div>
          </div>

          {erro && <p role="alert" className="text-sm text-error-primary">{erro}</p>}
          <div className="flex justify-end gap-3">
            <Button color="secondary" onClick={handleDescartar} isDisabled={confirmando}>Descartar e enviar outro</Button>
            <Button color="primary" onClick={handleConfirmar} isLoading={confirmando}>
              {confirmando ? "Criando pedido…" : "Confirmar importação"}
            </Button>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
