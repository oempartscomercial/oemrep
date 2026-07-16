"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "@untitledui/icons";
import { criarPedidoManual } from "../actions";
import { PageContainer } from "@/components/layouts/page-container";
import { PageHeader } from "@/components/patterns/page-header";
import { Button } from "@/components/ui/buttons/button";
import { Input } from "@/components/ui/input/input";
import { Select } from "@/components/ui/select/select";
import { Checkbox } from "@/components/ui/checkbox/checkbox";

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
    if (!fabricaId) {
      setClientes([]);
      return;
    }
    fetch(`/api/clientes?fabricaId=${fabricaId}`).then((r) => r.json()).then(setClientes);
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

      <form action={handleSubmit} className="flex max-w-2xl flex-col gap-6 rounded-xl bg-primary p-6 ring-1 ring-secondary">
        <div className="grid gap-5 sm:grid-cols-2">
          <Select
            name="fabricaId"
            label="Fábrica"
            placeholder="Selecione…"
            isRequired
            selectedKey={fabricaId || null}
            onSelectionChange={(key) => setFabricaId(key ? String(key) : "")}
            items={fabricas.map((f) => ({ id: f.id, label: f.nome }))}
          >
            {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
          </Select>

          <Select
            name="clienteId"
            label="Cliente"
            placeholder={fabricaId ? "Selecione…" : "Escolha a fábrica primeiro"}
            isRequired
            isDisabled={!fabricaId}
            items={clientes.map((c) => ({ id: c.id, label: c.nomeFantasia }))}
          >
            {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
          </Select>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Input name="numero" label="Número do pedido" placeholder="Ex.: PED-1001" isDisabled={semNumero} className="sm:max-w-xs" />
          <div className="pb-2.5">
            <Checkbox name="semNumero" value="on" isSelected={semNumero} onChange={setSemNumero} label="S/N (sem número)" />
          </div>
        </div>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 text-sm font-semibold text-primary">Itens</legend>
          {linhas.map((linha) => (
            <div key={linha} className="grid gap-3 sm:grid-cols-4">
              <Input name="referencia" placeholder="Referência" isRequired aria-label="Referência" />
              <Input name="descricao" placeholder="Descrição" aria-label="Descrição" />
              <Input name="quantidade" type="number" placeholder="Qtd" isRequired aria-label="Quantidade" />
              <Input name="valorUnitario" type="number" placeholder="Valor unit." isRequired aria-label="Valor unitário" />
            </div>
          ))}
          <div>
            <Button type="button" color="secondary" size="sm" iconLeading={Plus} onClick={() => setLinhas((atual) => [...atual, atual.length])}>
              Adicionar item
            </Button>
          </div>
        </fieldset>

        {erros.length > 0 && (
          <ul className="flex flex-col gap-1">
            {erros.map((erro) => (
              <li key={erro} className="text-sm text-error-primary">{erro}</li>
            ))}
          </ul>
        )}

        <div className="flex justify-end gap-3 border-t border-secondary pt-5">
          <Button type="button" color="secondary" href="/pedidos">Cancelar</Button>
          <Button type="submit" color="primary">Salvar pedido</Button>
        </div>
      </form>
    </PageContainer>
  );
}
