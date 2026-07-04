"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { criarPedidoManual } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Opcao = { id: string; nome?: string; nomeFantasia?: string };

export default function NovoPedidoPage() {
  const router = useRouter();
  const [erros, setErros] = useState<string[]>([]);
  const [fabricas, setFabricas] = useState<Opcao[]>([]);
  const [clientes, setClientes] = useState<Opcao[]>([]);
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
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Novo pedido</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="fabricaId">Fábrica</Label>
            <select
              id="fabricaId"
              name="fabricaId"
              className="rounded-md border px-3 py-2 text-sm"
              value={fabricaId}
              onChange={(e) => setFabricaId(e.target.value)}
              required
            >
              <option value="">Selecione...</option>
              {fabricas.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="clienteId">Cliente</Label>
            <select
              id="clienteId"
              name="clienteId"
              className="rounded-md border px-3 py-2 text-sm"
              required
              disabled={!fabricaId}
            >
              <option value="">Selecione...</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nomeFantasia}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Input
              name="numero"
              placeholder="Número do pedido"
              disabled={semNumero}
              className="max-w-xs"
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="semNumero"
                checked={semNumero}
                onChange={(e) => setSemNumero(e.target.checked)}
              />
              S/N (sem número)
            </label>
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium">Itens</legend>
            {linhas.map((linha) => (
              <div key={linha} className="flex gap-2">
                <Input name="referencia" placeholder="Referência" required />
                <Input name="descricao" placeholder="Descrição" />
                <Input name="quantidade" type="number" placeholder="Qtd" required />
                <Input name="valorUnitario" type="number" step="0.01" placeholder="Valor unit." required />
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              onClick={() => setLinhas((atual) => [...atual, atual.length])}
            >
              + Adicionar item
            </Button>
          </fieldset>

          {erros.map((erro) => (
            <p key={erro} className="text-sm text-destructive">
              {erro}
            </p>
          ))}
          <Button type="submit">Salvar</Button>
        </form>
      </CardContent>
    </Card>
  );
}
