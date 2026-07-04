"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { analisarPlanilha, confirmarImportacao } from "./actions";
import type { ItemExtraido } from "@/domain/importacao/excel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Opcao = { id: string; nome?: string; nomeFantasia?: string };

export default function ImportarPedidoPage() {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [itens, setItens] = useState<ItemExtraido[] | null>(null);
  const [fabricas, setFabricas] = useState<Opcao[]>([]);
  const [clientes, setClientes] = useState<Opcao[]>([]);
  const [fabricaId, setFabricaId] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [numero, setNumero] = useState("");
  const [semNumero, setSemNumero] = useState(false);

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

  async function handleAnalisar(formData: FormData) {
    setErro(null);
    const resultado = await analisarPlanilha(formData);
    if (resultado.erro) {
      setErro(resultado.erro);
      return;
    }
    setItens(resultado.itens ?? []);
  }

  async function handleConfirmar() {
    if (!itens) return;
    const resultado = await confirmarImportacao({ fabricaId, clienteId, numero, semNumero, itens });
    if (resultado.erros.length > 0) {
      setErro(resultado.erros.join(" "));
      return;
    }
    router.push("/pedidos");
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Importar pedido (Excel)</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!itens && (
          <form action={handleAnalisar} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="arquivo">Planilha (.xlsx)</Label>
              <Input id="arquivo" name="arquivo" type="file" accept=".xlsx" required />
            </div>
            {erro && <p className="text-sm text-destructive">{erro}</p>}
            <Button type="submit">Analisar planilha</Button>
          </form>
        )}

        {itens && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="fabricaId">Fábrica</Label>
              <select
                id="fabricaId"
                className="rounded-md border px-3 py-2 text-sm"
                value={fabricaId}
                onChange={(e) => setFabricaId(e.target.value)}
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
                className="rounded-md border px-3 py-2 text-sm"
                value={clienteId}
                onChange={(e) => setClienteId(e.target.value)}
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
                placeholder="Número do pedido"
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
                disabled={semNumero}
                className="max-w-xs"
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={semNumero}
                  onChange={(e) => setSemNumero(e.target.checked)}
                />
                S/N (sem número)
              </label>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Referência</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Qtd</TableHead>
                  <TableHead>Valor unit.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {itens.map((item, i) => (
                  <TableRow key={i}>
                    <TableCell>{item.referencia}</TableCell>
                    <TableCell>{item.descricao}</TableCell>
                    <TableCell>{item.quantidade}</TableCell>
                    <TableCell>{item.valorUnitario}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {erro && <p className="text-sm text-destructive">{erro}</p>}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setItens(null)}>
                Escolher outro arquivo
              </Button>
              <Button onClick={handleConfirmar}>Confirmar importação</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
