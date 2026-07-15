"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { abrirChamado } from "../actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

type Motivo = { id: string; nome: string };
type ItemDisponivel = {
  itemPedidoId: string;
  referencia: string;
  descricao: string;
  pedidoNumero: string;
};

export function ChamadoForm({
  notaFiscalId,
  motivos,
  itensDisponiveis,
}: {
  notaFiscalId: string;
  motivos: Motivo[];
  itensDisponiveis: ItemDisponivel[];
}) {
  const router = useRouter();
  const [erros, setErros] = useState<string[]>([]);

  async function handleSubmit(formData: FormData) {
    const resultado = await abrirChamado(formData);
    if (resultado.erros.length > 0) {
      setErros(resultado.erros);
      return;
    }
    router.push(`/divergencias/${resultado.chamadoId}`);
  }

  return (
    <Card className="max-w-2xl">
      <CardContent>
        <form action={handleSubmit} className="flex flex-col gap-4">
          <input type="hidden" name="notaFiscalId" value={notaFiscalId} />

          <div className="flex flex-col gap-2">
            <Label htmlFor="motivoId">Motivo</Label>
            <select id="motivoId" name="motivoId" className="rounded-md border px-3 py-2 text-sm" required>
              <option value="">Selecione...</option>
              {motivos.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome}
                </option>
              ))}
            </select>
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium">Itens afetados</legend>
            {itensDisponiveis.map((item) => (
              <label key={item.itemPedidoId} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="itemPedidoId" value={item.itemPedidoId} />
                Pedido {item.pedidoNumero} · {item.referencia} — {item.descricao}
              </label>
            ))}
          </fieldset>

          <div className="flex flex-col gap-2">
            <Label htmlFor="observacao">Descrição da divergência</Label>
            <textarea
              id="observacao"
              name="observacao"
              className="rounded-md border px-3 py-2 text-sm"
              rows={4}
              required
            />
          </div>

          {erros.map((erro) => (
            <p key={erro} className="text-sm text-destructive">
              {erro}
            </p>
          ))}
          <Button type="submit">Abrir chamado</Button>
        </form>
      </CardContent>
    </Card>
  );
}
