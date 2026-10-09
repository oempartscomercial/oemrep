"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Link2, Plus, Trash2 } from "lucide-react";
import { iniciarExtracaoPdf, confirmarImportacaoPdf, descartarRascunhoPdf, cadastrarClienteDoPdf, type RascunhoPdf } from "./actions";
import { numeroBr } from "@/domain/importacao/pdf";
import { formatarReais } from "@/domain/formato/moeda";
import { PageContainer } from "@/components/layouts/page-container";
import { PageHeader } from "@/components/patterns/page-header";
import { Botao } from "@/components/patterns/botao";
import { CampoCheckbox, CampoSelect, CampoTexto } from "@/components/patterns/campo";
import { Input } from "@/components/ui/input";

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
  const [numeroCliente, setNumeroCliente] = useState("");
  const [dataPedido, setDataPedido] = useState("");
  const [transportador, setTransportador] = useState("");
  const [completarId, setCompletarId] = useState<string | null>(null);
  const [nomeClienteNovo, setNomeClienteNovo] = useState("");
  const [cadastrandoCliente, setCadastrandoCliente] = useState(false);
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
    setNumeroCliente(r.cabecalho.numeroPedidoCliente);
    setDataPedido(r.cabecalho.data ?? "");
    setTransportador(r.cabecalho.transportador);
    setCompletarId(r.parecido?.id ?? null);
  }

  async function handleCadastrarCliente() {
    if (!rascunho) return;
    setCadastrandoCliente(true);
    const r = await cadastrarClienteDoPdf({ nome: nomeClienteNovo, cnpj: rascunho.clienteCnpj, fabricaId });
    setCadastrandoCliente(false);
    if (r.erros.length > 0 || !r.cliente) return setErro(r.erros[0] ?? "Não foi possível cadastrar o cliente.");
    const novo = r.cliente;
    setErro(null);
    setClientes((atual) => (atual.some((c) => c.id === novo.id) ? atual : [...atual, novo].sort((a, b) => a.nomeFantasia.localeCompare(b.nomeFantasia))));
    setClienteId(novo.id);
    setRascunho({ ...rascunho, cliente: novo });
    toast.success(`${novo.nomeFantasia} cadastrado e ligado à fábrica.`);
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
      numeroCliente,
      dataPedido: dataPedido || null,
      transportadorPrevisto: transportador,
      modalidadeFrete: rascunho.cabecalho.modalidadeFrete,
      vendedor: rascunho.cabecalho.vendedor,
      completarPedidoId: completarId,
    });
    setConfirmando(false);
    if (resultado.erros.length > 0 || !resultado.pedidoId) {
      setErro(resultado.erros.join(" ") || "Nada foi salvo — tente novamente.");
      return;
    }
    toast.success(
      `${completarId ? "Pedido completado" : "Pedido criado"}: ${semNumero ? "S/N" : numero} · ${linhas.length} itens · ${formatarReais(totalCalculado)}`,
    );
    router.push(`/pedidos/${resultado.pedidoId}`);
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
        <div className="flex max-w-2xl flex-col gap-4">
          <div className="rounded-lg border border-dashed p-6">
            <Input
              type="file"
              accept="application/pdf,.pdf"
              aria-label="PDF do pedido"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                if (f && !/\.pdf$/i.test(f.name) && f.type !== "application/pdf") {
                  setArquivo(null);
                  return setErro("Esse arquivo não é um PDF. Envie o PDF do pedido.");
                }
                setErro(null);
                setArquivo(f);
              }}
            />
            <p className="mt-2 text-xs text-muted-foreground">Apenas arquivos .pdf</p>
          </div>
          {arquivo && <p className="text-sm text-foreground/80">Selecionado: <span className="font-medium text-foreground">{arquivo.name}</span></p>}
          {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
          <p className="text-xs text-muted-foreground">
            Os itens são lidos do texto do PDF. Confira tudo na próxima tela antes de confirmar — PDF escaneado (foto) não tem texto para ler.
          </p>
          <div>
            <Botao variante="primario" disabled={!arquivo} carregando={lendo} onClick={handleLer}>
              {lendo ? "Lendo o pedido…" : "Ler pedido"}
            </Botao>
          </div>
        </div>
      )}

      {rascunho && (
        <div className="flex flex-col gap-6">
          {/* Conferência aritmética: a prova de que a leitura fechou com o próprio PDF. */}
          {rascunho.conferencia.confere ? (
            <div className="flex items-center gap-2 rounded-lg bg-success-soft px-4 py-3 text-sm text-success">
              <CheckCircle2 className="size-5 shrink-0" />
              <span>Os totais do PDF batem com o que foi lido ({rascunho.conferencia.itensLidos} itens · {formatarReais(totalCalculado)}). Confira e confirme.</span>
            </div>
          ) : (
            <div className="flex items-start gap-2 rounded-lg bg-warning-soft px-4 py-3 text-sm text-warning">
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

          {rascunho.parecido && clienteId === rascunho.cliente?.id && (
            <div className="flex max-w-2xl flex-col gap-3 rounded-lg border border-primary/30 bg-card px-4 py-3 text-sm">
              <div className="flex items-start gap-2">
                <Link2 className="mt-0.5 size-4 shrink-0" />
                <p>
                  Parece ser o pedido que você registrou em {new Date(`${rascunho.parecido.data}T12:00:00`).toLocaleDateString("pt-BR")}
                  {rascunho.parecido.numero ? ` (nº ${rascunho.parecido.numero})` : ""} por {formatarReais(rascunho.parecido.valor)}, ainda sem itens.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Botao size="sm" className="h-11 md:h-7" variante={completarId ? "primario" : "secundario"} onClick={() => setCompletarId(rascunho.parecido!.id)}>
                  Completar aquele pedido
                </Botao>
                <Botao size="sm" className="h-11 md:h-7" variante={completarId ? "secundario" : "primario"} onClick={() => setCompletarId(null)}>
                  Criar outro pedido
                </Botao>
              </div>
            </div>
          )}

          {/* Cabeçalho pré-preenchido pelo CNPJ do PDF, sempre editável. */}
          <div className="flex max-w-2xl flex-col gap-5 rounded-lg border bg-card p-6">
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <CampoSelect
                  rotulo="Fábrica"
                  placeholder="Selecione…"
                  valor={fabricaId}
                  aoMudar={(v) => { setFabricaId(v); setClienteId(""); }}
                  opcoes={fabricas.map((f) => ({ id: f.id, label: f.nome }))}
                />
                {!rascunho.fabrica && (
                  <p className="mt-1 text-xs text-warning">CNPJ {rascunho.fabricaCnpj || "não lido"} não bateu com nenhuma fábrica cadastrada.</p>
                )}
              </div>
              <div>
                <CampoSelect
                  rotulo="Cliente"
                  placeholder={fabricaId ? "Selecione…" : "Escolha a fábrica primeiro"}
                  desabilitado={!fabricaId}
                  valor={clienteId}
                  aoMudar={setClienteId}
                  opcoes={clientes.map((c) => ({ id: c.id, label: c.nomeFantasia }))}
                />
                {!rascunho.cliente && (
                  <div className="mt-1 flex flex-col gap-2">
                    <p className="text-xs text-warning">CNPJ {rascunho.clienteCnpj || "não lido"} não bateu com nenhum cliente cadastrado.</p>
                    {rascunho.clienteCnpj && fabricaId && (
                      <div className="flex flex-col gap-2 rounded-md border border-dashed p-2 sm:flex-row sm:items-end">
                        <CampoTexto rotulo="Nome do cliente" value={nomeClienteNovo} onChange={(e) => setNomeClienteNovo(e.target.value)} className="sm:flex-1" />
                        <Botao size="sm" className="h-11 md:h-8" carregando={cadastrandoCliente} disabled={!nomeClienteNovo.trim()} onClick={handleCadastrarCliente}>
                          Cadastrar com este CNPJ
                        </Botao>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <CampoTexto rotulo="Número do pedido" placeholder="Ex.: 4103" value={numero} onChange={(e) => setNumero(e.target.value)} disabled={semNumero} className="sm:max-w-xs" />
              <div className="pb-2">
                <CampoCheckbox rotulo="S/N (sem número)" marcado={semNumero} aoMudar={setSemNumero} />
              </div>
            </div>
            <div className="grid gap-5 sm:grid-cols-3">
              <CampoTexto rotulo="Nº do pedido do cliente" dica="Ordem de compra." value={numeroCliente} onChange={(e) => setNumeroCliente(e.target.value)} />
              <CampoTexto rotulo="Data do pedido" type="date" value={dataPedido} onChange={(e) => setDataPedido(e.target.value)} />
              <CampoTexto
                rotulo="Transportadora"
                dica={rascunho.cabecalho.modalidadeFrete ? `Frete: ${rascunho.cabecalho.modalidadeFrete}` : "Se o PDF disser."}
                value={transportador}
                onChange={(e) => setTransportador(e.target.value)}
              />
            </div>
            {rascunho.cabecalho.vendedor && <p className="text-xs text-muted-foreground">Vendedor no PDF: {rascunho.cabecalho.vendedor}</p>}
          </div>

          {/* Grade editável — o coração do fluxo: nada é gravado sem passar por aqui. */}
          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="w-40 px-4 py-3 font-medium">Referência</th>
                  <th className="px-4 py-3 font-medium">Descrição</th>
                  <th className="w-24 px-4 py-3 font-medium">Qtd</th>
                  <th className="w-32 px-4 py-3 font-medium">Valor unit.</th>
                  <th className="w-10 px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l, i) => (
                  <tr key={i} className={`border-b last:border-0 ${l.problemas.length > 0 ? "bg-warning-soft" : ""}`}>
                    <td className="px-4 py-2 align-top">
                      <Input aria-label={`Referência ${i + 1}`} value={l.referencia} onChange={(e) => atualizarLinha(i, "referencia", e.target.value)} />
                    </td>
                    <td className="px-4 py-2 align-top">
                      <Input aria-label={`Descrição ${i + 1}`} value={l.descricao} onChange={(e) => atualizarLinha(i, "descricao", e.target.value)} />
                      {l.problemas.length > 0 && (
                        <ul className="mt-1 list-disc pl-4 text-xs text-warning">
                          {l.problemas.map((p, k) => <li key={k}>{p}</li>)}
                        </ul>
                      )}
                    </td>
                    <td className="px-4 py-2 align-top">
                      <Input aria-label={`Quantidade ${i + 1}`} value={l.quantidade} onChange={(e) => atualizarLinha(i, "quantidade", e.target.value)} />
                    </td>
                    <td className="px-4 py-2 align-top">
                      <Input aria-label={`Valor unitário ${i + 1}`} value={l.valorUnitario} onChange={(e) => atualizarLinha(i, "valorUnitario", e.target.value)} />
                    </td>
                    <td className="px-4 py-2 align-top">
                      <Botao variante="ghost" size="sm" aria-label={`Remover linha ${i + 1}`} onClick={() => removerLinha(i)} icone={<Trash2 />} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex items-center justify-between px-4 py-3">
              <Botao variante="ghost" size="sm" onClick={adicionarLinha} icone={<Plus />}>Adicionar linha</Botao>
              <span className="text-sm text-foreground/80">{linhas.length} itens · total {formatarReais(totalCalculado)}</span>
            </div>
          </div>

          {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
          <div className="flex justify-end gap-3">
            <Botao variante="secundario" onClick={handleDescartar} disabled={confirmando}>Descartar e enviar outro</Botao>
            <Botao variante="primario" onClick={handleConfirmar} carregando={confirmando}>
              {confirmando ? "Gravando…" : completarId ? "Completar pedido" : "Criar pedido"}
            </Botao>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
