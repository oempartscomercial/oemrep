"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { criarPedidoManual } from "../actions";
import { PageContainer } from "@/components/layouts/page-container";
import { PageHeader } from "@/components/patterns/page-header";
import { Botao } from "@/components/patterns/botao";
import { CampoCheckbox, CampoSelect, CampoTexto } from "@/components/patterns/campo";
import { Input } from "@/components/ui/input";

type Fabrica = { id: string; nome: string };
type Cliente = { id: string; nomeFantasia: string };

export default function NovoPedidoPage() {
  const router = useRouter();
  const [erros, setErros] = useState<string[]>([]);
  const [fabricas, setFabricas] = useState<Fabrica[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [fabricaId, setFabricaId] = useState("");
  const [semNumero, setSemNumero] = useState(false);
  const [linhas, setLinhas] = useState([0]);

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

  async function handleSubmit(formData: FormData) {
    const resultado = await criarPedidoManual(formData);
    if (resultado.erros.length > 0) {
      setErros(resultado.erros);
      return;
    }
    router.push("/pedidos");
  }

  return (
    <PageContainer>
      <PageHeader titulo="Novo pedido" descricao="Cadastre um pedido manualmente." />

      <form action={handleSubmit} className="flex max-w-xl flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <CampoSelect
            name="fabricaId"
            rotulo="Fábrica"
            obrigatorio
            aoMudar={setFabricaId}
            opcoes={fabricas.map((f) => ({ id: f.id, label: f.nome }))}
          />
          <CampoSelect
            key={fabricaId}
            name="clienteId"
            rotulo="Cliente"
            placeholder={fabricaId ? "Selecione…" : "Escolha a fábrica primeiro"}
            obrigatorio
            desabilitado={!fabricaId}
            opcoes={clientes.map((c) => ({ id: c.id, label: c.nomeFantasia }))}
          />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <CampoTexto name="numero" rotulo="Número do pedido" placeholder="Ex.: PED-1001" disabled={semNumero} className="sm:max-w-xs sm:flex-1" />
          <div className="pb-1.5">
            <CampoCheckbox name="semNumero" rotulo="S/N (sem número)" marcado={semNumero} aoMudar={setSemNumero} />
          </div>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-semibold">Itens</legend>
          {linhas.map((linha) => (
            <div key={linha} className="grid gap-2 sm:grid-cols-4">
              <Input name="referencia" placeholder="Referência" required aria-label="Referência" />
              <Input name="descricao" placeholder="Descrição" aria-label="Descrição" />
              <Input name="quantidade" type="number" placeholder="Qtd" required aria-label="Quantidade" />
              <Input name="valorUnitario" type="number" placeholder="Valor unit." required aria-label="Valor unitário" />
            </div>
          ))}
          <div>
            <Botao type="button" variante="secundario" size="sm" icone={<Plus />} onClick={() => setLinhas((atual) => [...atual, atual.length])}>
              Adicionar item
            </Botao>
          </div>
        </fieldset>

        {erros.length > 0 && (
          <ul className="flex flex-col gap-1">
            {erros.map((erro) => (
              <li key={erro} className="text-sm text-destructive">{erro}</li>
            ))}
          </ul>
        )}

        <div className="flex gap-2 border-t pt-4">
          <Botao type="submit" variante="primario">Salvar pedido</Botao>
          <Botao type="button" variante="secundario" href="/pedidos">Cancelar</Botao>
        </div>
      </form>
    </PageContainer>
  );
}
