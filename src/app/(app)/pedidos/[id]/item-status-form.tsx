"use client";

import { useState } from "react";
import { atualizarStatusItem } from "./actions";
import type { StatusItemPedido } from "@/domain/pedido/estado";

const OPCOES: StatusItemPedido[] = ["PENDENTE", "OK", "FORA_DE_FABRICACAO", "DESISTENCIA"];

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

  return (
    <div className="flex flex-col gap-1">
      <select
        className="rounded-md border px-2 py-1 text-sm"
        value={status}
        onChange={(e) => handleChange(e.target.value as StatusItemPedido)}
      >
        {OPCOES.map((opcao) => (
          <option key={opcao} value={opcao}>
            {opcao}
          </option>
        ))}
      </select>
      {(status === "FORA_DE_FABRICACAO" || status === "DESISTENCIA") && (
        <input
          className="rounded-md border px-2 py-1 text-xs"
          placeholder="Observação"
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          onBlur={() => atualizarStatusItem(itemId, status, observacao)}
        />
      )}
      {erro && <p className="text-xs text-destructive">{erro}</p>}
    </div>
  );
}
