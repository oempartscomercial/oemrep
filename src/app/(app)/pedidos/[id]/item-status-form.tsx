"use client";

import { useState } from "react";
import { atualizarStatusItem } from "./actions";
import type { StatusItemPedido } from "@/domain/pedido/estado";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

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
      <Select value={status} onValueChange={(valor) => handleChange(valor as StatusItemPedido)}>
        <SelectTrigger size="sm" aria-label="Status do item" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {OPCOES.map((opcao) => (
            <SelectItem key={opcao.id} value={opcao.id}>
              {opcao.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {precisaObservacao && (
        <Input
          className="h-7 md:h-7"
          aria-label="Observação"
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
