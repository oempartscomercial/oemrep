"use client";

import { useState } from "react";
import { atualizarStatusItem } from "./actions";
import type { StatusItemPedido } from "@/domain/pedido/estado";
import { Select } from "@/components/ui/select/select";
import { Input } from "@/components/ui/input/input";

const OPCOES: { id: StatusItemPedido; label: string }[] = [
  { id: "PENDENTE", label: "Pendente" },
  { id: "OK", label: "OK" },
  { id: "FORA_DE_FABRICACAO", label: "Fora de fabricação" },
  { id: "DESISTENCIA", label: "Desistência" },
];

export function ItemStatusForm({
  itemId,
  statusAtual,
  observacaoAtual,
}: {
  itemId: string;
  statusAtual: StatusItemPedido;
  observacaoAtual: string;
}) {
  const [status, setStatus] = useState<StatusItemPedido>(statusAtual);
  const [observacao, setObservacao] = useState(observacaoAtual);
  const [erro, setErro] = useState<string | null>(null);

  async function handleChange(novoStatus: StatusItemPedido) {
    setStatus(novoStatus);
    const resultado = await atualizarStatusItem(itemId, novoStatus, observacao);
    if (resultado.erros.length > 0) setErro(resultado.erros.join(" "));
    else setErro(null);
  }

  const precisaObservacao = status === "FORA_DE_FABRICACAO" || status === "DESISTENCIA";

  return (
    <div className="flex min-w-44 flex-col gap-1.5">
      <Select
        size="sm"
        aria-label="Status do item"
        selectedKey={status}
        onSelectionChange={(key) => handleChange(key as StatusItemPedido)}
        items={OPCOES}
      >
        {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
      </Select>
      {precisaObservacao && (
        <Input
          size="sm"
          aria-label="Observação"
          placeholder="Observação"
          value={observacao}
          onChange={setObservacao}
          onBlur={() => atualizarStatusItem(itemId, status, observacao)}
        />
      )}
      {erro && <p className="text-xs text-error-primary">{erro}</p>}
    </div>
  );
}
