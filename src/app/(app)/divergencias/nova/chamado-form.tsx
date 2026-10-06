"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { abrirChamado } from "../actions";
import { Botao } from "@/components/patterns/botao";
import { CampoSelect, CampoTextarea } from "@/components/patterns/campo";
import { Checkbox } from "@/components/ui/checkbox";

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
    <form action={handleSubmit} className="flex max-w-xl flex-col gap-4">
      <input type="hidden" name="notaFiscalId" value={notaFiscalId} />

      <CampoSelect
        name="motivoId"
        rotulo="Motivo"
        placeholder="Selecione…"
        obrigatorio
        opcoes={motivos.map((m) => ({ id: m.id, label: m.nome }))}
      />

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Itens afetados</legend>
        {itensDisponiveis.map((item) => (
          <label key={item.itemPedidoId} className="flex items-start gap-2 text-sm">
            <Checkbox name="itemPedidoId" value={item.itemPedidoId} className="mt-0.5" />
            <span>{`Pedido ${item.pedidoNumero} · ${item.referencia} — ${item.descricao}`}</span>
          </label>
        ))}
      </fieldset>

      <CampoTextarea name="observacao" rotulo="Descrição da divergência" placeholder="Descreva o problema…" obrigatorio rows={4} />

      {erros.length > 0 && (
        <ul className="flex flex-col gap-1">{erros.map((e) => <li key={e} className="text-sm text-destructive">{e}</li>)}</ul>
      )}
      <div className="flex gap-2">
        <Botao type="submit" variante="primario">Abrir chamado</Botao>
        <Botao type="button" variante="secundario" href="/divergencias">Cancelar</Botao>
      </div>
    </form>
  );
}
