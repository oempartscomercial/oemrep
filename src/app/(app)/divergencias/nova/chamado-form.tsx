"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { abrirChamado } from "../actions";
import { Button } from "@/components/ui/buttons/button";
import { Select } from "@/components/ui/select/select";
import { Checkbox } from "@/components/ui/checkbox/checkbox";
import { TextArea } from "@/components/ui/textarea/textarea";

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
    <form action={handleSubmit} className="flex max-w-2xl flex-col gap-5 rounded-xl bg-primary p-6 ring-1 ring-secondary">
      <input type="hidden" name="notaFiscalId" value={notaFiscalId} />

      <Select name="motivoId" label="Motivo" placeholder="Selecione…" isRequired items={motivos.map((m) => ({ id: m.id, label: m.nome }))}>
        {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
      </Select>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-secondary">Itens afetados</legend>
        {itensDisponiveis.map((item) => (
          <Checkbox
            key={item.itemPedidoId}
            name="itemPedidoId"
            value={item.itemPedidoId}
            label={`Pedido ${item.pedidoNumero} · ${item.referencia} — ${item.descricao}`}
          />
        ))}
      </fieldset>

      <TextArea name="observacao" label="Descrição da divergência" placeholder="Descreva o problema…" isRequired rows={4} />

      {erros.length > 0 && (
        <ul className="flex flex-col gap-1">{erros.map((e) => <li key={e} className="text-sm text-error-primary">{e}</li>)}</ul>
      )}
      <div className="flex justify-end gap-3 border-t border-secondary pt-5">
        <Button type="button" color="secondary" href="/divergencias">Cancelar</Button>
        <Button type="submit" color="primary">Abrir chamado</Button>
      </div>
    </form>
  );
}
