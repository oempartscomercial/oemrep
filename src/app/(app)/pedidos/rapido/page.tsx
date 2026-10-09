"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Search, UserPlus, X } from "lucide-react";
import {
  buscarClientesParaPedido,
  criarPedidoRapido,
  desfazerPedidoRapido,
  type ClienteEncontrado,
} from "../actions";
import { PageContainer } from "@/components/layouts/page-container";
import { PageHeader } from "@/components/patterns/page-header";
import { Botao } from "@/components/patterns/botao";
import { Campo, CampoSelect, CampoTextarea, CampoTexto } from "@/components/patterns/campo";
import { Input } from "@/components/ui/input";

type Fabrica = { id: string; nome: string };

const CHAVE_ULTIMA_FABRICA = "pedido-rapido:fabrica";

function hojeEmSaoPaulo(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

function lerUltimaFabrica(): string {
  try {
    return localStorage.getItem(CHAVE_ULTIMA_FABRICA) ?? "";
  } catch {
    return "";
  }
}

function guardarUltimaFabrica(id: string) {
  try {
    localStorage.setItem(CHAVE_ULTIMA_FABRICA, id);
  } catch {
    // Sem armazenamento (aba privada): só não lembra a fábrica.
  }
}

/**
 * Registrar pedido do WhatsApp: o pedido chegou como print, só com cliente e valor. Cinco
 * campos, cabe no celular. Os itens entram depois pelo PDF do pedido ou pela nota.
 */
export default function PedidoRapidoPage() {
  const router = useRouter();
  const [fabricas, setFabricas] = useState<Fabrica[]>([]);
  const [fabricaId, setFabricaId] = useState("");

  const [termo, setTermo] = useState("");
  const [encontrados, setEncontrados] = useState<ClienteEncontrado[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [cliente, setCliente] = useState<ClienteEncontrado | null>(null);
  const [novoCliente, setNovoCliente] = useState<{ nome: string; cnpj: string } | null>(null);

  const [valorTotal, setValorTotal] = useState("");
  const [dataPedido, setDataPedido] = useState(hojeEmSaoPaulo);
  const [numero, setNumero] = useState("");
  const [numeroCliente, setNumeroCliente] = useState("");
  const [observacao, setObservacao] = useState("");

  const [erros, setErros] = useState<string[]>([]);
  const [enviando, setEnviando] = useState<"outro" | "abrir" | null>(null);
  const buscaRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/fabricas")
      .then((r) => r.json())
      .then((lista: Fabrica[]) => {
        setFabricas(lista);
        const ultima = lerUltimaFabrica();
        if (ultima && lista.some((f) => f.id === ultima)) setFabricaId(ultima);
      })
      .catch(() => {});
  }, []);

  // Busca de cliente com uma pausa curta entre teclas.
  useEffect(() => {
    if (cliente || novoCliente) return;
    const t = termo.trim();
    if (t.length < 2) return;
    let ativo = true;
    const id = setTimeout(async () => {
      const lista = await buscarClientesParaPedido(t);
      if (!ativo) return;
      setEncontrados(lista);
      setBuscando(false);
    }, 250);
    return () => {
      ativo = false;
      clearTimeout(id);
    };
  }, [termo, cliente, novoCliente]);

  function limparCliente() {
    setCliente(null);
    setNovoCliente(null);
    setTermo("");
    setEncontrados([]);
    setTimeout(() => buscaRef.current?.focus(), 0);
  }

  function limparFormulario() {
    limparCliente();
    setValorTotal("");
    setNumero("");
    setNumeroCliente("");
    setObservacao("");
    setErros([]);
  }

  async function registrar(depois: "outro" | "abrir") {
    setErros([]);
    setEnviando(depois);
    const r = await criarPedidoRapido({
      fabricaId,
      clienteId: cliente?.id ?? "",
      novoCliente,
      valorTotal,
      dataPedido,
      numero,
      numeroCliente,
      observacao,
    });
    setEnviando(null);
    if (r.erros.length > 0 || !r.pedidoId) {
      setErros(r.erros.length ? r.erros : ["Não foi possível registrar. Tente de novo."]);
      return;
    }
    guardarUltimaFabrica(fabricaId);
    const pedidoId = r.pedidoId;
    toast.success(`Registrado: ${r.resumo}`, {
      description: "Aguardando nota da fábrica.",
      duration: 10000,
      action: {
        label: "Desfazer",
        onClick: async () => {
          const d = await desfazerPedidoRapido(pedidoId);
          if (d.erros.length) toast.error(d.erros[0]);
          else toast("Pedido desfeito. Nada ficou registrado.");
          router.refresh();
        },
      },
    });
    if (depois === "abrir") router.push(`/pedidos/${pedidoId}`);
    else limparFormulario();
  }

  const clienteEscolhido = cliente || novoCliente;

  return (
    <PageContainer>
      <PageHeader
        titulo="Registrar pedido rápido"
        descricao="Para pedido que chegou por WhatsApp ou recado, sem PDF. Só o que você sabe agora; os itens entram depois."
      />

      <div className="flex max-w-xl flex-col gap-5">
        <CampoSelect
          rotulo="Fábrica"
          obrigatorio
          placeholder="Escolha a fábrica"
          valor={fabricaId}
          aoMudar={setFabricaId}
          opcoes={fabricas.map((f) => ({ id: f.id, label: f.nome }))}
        />

        <Campo rotulo="Cliente" obrigatorio htmlFor="busca-cliente">
          {clienteEscolhido ? (
            <div className="flex items-start justify-between gap-3 rounded-md border bg-card px-3 py-2">
              <div className="min-w-0 text-sm">
                <p className="font-medium">
                  {cliente?.nome ?? novoCliente?.nome}
                  {novoCliente && <span className="ml-2 text-xs font-normal text-muted-foreground">cliente novo</span>}
                </p>
                {cliente && (
                  <p className="text-xs text-muted-foreground">
                    {[cliente.cnpj, [cliente.cidade, cliente.uf].filter(Boolean).join("/")].filter(Boolean).join(" · ") || "sem CNPJ cadastrado"}
                  </p>
                )}
              </div>
              <Botao variante="ghost" size="sm" className="h-11 md:h-7" icone={<X />} onClick={limparCliente}>
                Trocar
              </Botao>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="busca-cliente"
                  ref={buscaRef}
                  className="h-11 pl-8 md:h-8"
                  placeholder="Nome ou CNPJ"
                  autoComplete="off"
                  value={termo}
                  onChange={(e) => {
                    setTermo(e.target.value);
                    setBuscando(true);
                  }}
                />
              </div>
              {termo.trim().length >= 2 && (
                <ul className="flex flex-col overflow-hidden rounded-md border bg-card" aria-label="Clientes encontrados">
                  {encontrados.map((c) => (
                    <li key={c.id} className="border-b last:border-0">
                      <button
                        type="button"
                        className="flex min-h-11 w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-muted md:min-h-0"
                        onClick={() => setCliente(c)}
                      >
                        <span className="font-medium">{c.nome}</span>
                        <span className="text-xs text-muted-foreground">
                          {[c.cnpj, [c.cidade, c.uf].filter(Boolean).join("/")].filter(Boolean).join(" · ") || "sem CNPJ cadastrado"}
                        </span>
                      </button>
                    </li>
                  ))}
                  {!buscando && encontrados.length === 0 && (
                    <li className="px-3 py-2 text-xs text-muted-foreground">Nenhum cliente com esse nome ou CNPJ.</li>
                  )}
                  <li className="border-t">
                    <button
                      type="button"
                      className="flex min-h-11 w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium hover:bg-muted md:min-h-0"
                      onClick={() => setNovoCliente({ nome: /\d{6,}/.test(termo) ? "" : termo.trim(), cnpj: /\d{6,}/.test(termo) ? termo.trim() : "" })}
                    >
                      <UserPlus className="size-4" />
                      Cadastrar cliente novo{/\d{6,}/.test(termo) ? "" : ` “${termo.trim()}”`}
                    </button>
                  </li>
                </ul>
              )}
            </div>
          )}
        </Campo>

        {novoCliente && (
          <div className="grid gap-4 rounded-md border border-dashed p-3 sm:grid-cols-2">
            <CampoTexto
              rotulo="Nome do cliente"
              obrigatorio
              value={novoCliente.nome}
              onChange={(e) => setNovoCliente({ ...novoCliente, nome: e.target.value })}
            />
            <CampoTexto
              rotulo="CNPJ"
              dica="Se não souber agora, deixe em branco."
              inputMode="numeric"
              value={novoCliente.cnpj}
              onChange={(e) => setNovoCliente({ ...novoCliente, cnpj: e.target.value })}
            />
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <CampoTexto
            rotulo="Valor total"
            obrigatorio
            inputMode="decimal"
            placeholder="R$ 0,00"
            dica="Como veio no print."
            value={valorTotal}
            onChange={(e) => setValorTotal(e.target.value)}
          />
          <CampoTexto rotulo="Data do pedido" obrigatorio type="date" value={dataPedido} onChange={(e) => setDataPedido(e.target.value)} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <CampoTexto rotulo="Nº do pedido" dica="Opcional." value={numero} onChange={(e) => setNumero(e.target.value)} />
          <CampoTexto
            rotulo="Nº do pedido do cliente"
            dica="Ordem de compra. Ajuda a achar a nota depois."
            value={numeroCliente}
            onChange={(e) => setNumeroCliente(e.target.value)}
          />
        </div>

        <CampoTextarea
          rotulo="Observação"
          placeholder="Ex.: print do Patrick no grupo da Autoflex"
          rows={2}
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
        />

        {erros.length > 0 && (
          <ul role="alert" className="flex flex-col gap-1">
            {erros.map((e) => (
              <li key={e} className="text-sm text-destructive">{e}</li>
            ))}
          </ul>
        )}

        <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
          <Botao variante="secundario" className="h-11 md:h-8" carregando={enviando === "abrir"} disabled={!!enviando} onClick={() => registrar("abrir")}>
            Registrar e abrir
          </Botao>
          <Botao variante="primario" className="h-11 md:h-8" carregando={enviando === "outro"} disabled={!!enviando} onClick={() => registrar("outro")}>
            Registrar e fazer outro
          </Botao>
        </div>
      </div>
    </PageContainer>
  );
}
