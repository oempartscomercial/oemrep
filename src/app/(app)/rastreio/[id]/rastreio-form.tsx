"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { avancarRastreio } from "../actions";
import type { StatusRastreio } from "@/domain/nfe/rastreio";
import { statusBadgeConfig } from "@/components/patterns/status-badge.config";
import { Button } from "@/components/ui/buttons/button";
import { Input } from "@/components/ui/input/input";
import { Select } from "@/components/ui/select/select";

export function RastreioForm({
  notaFiscalId,
  proximos,
}: {
  notaFiscalId: string;
  proximos: StatusRastreio[];
}) {
  const router = useRouter();
  const [status, setStatus] = useState<StatusRastreio>(proximos[0]);
  const [observacao, setObservacao] = useState("");
  const [dataEvento, setDataEvento] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setErro(null);
    const resultado = await avancarRastreio(notaFiscalId, status, observacao, dataEvento);
    setEnviando(false);
    if (resultado.erros.length > 0) {
      setErro(resultado.erros.join(" "));
      return;
    }
    setObservacao("");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl bg-primary p-6 ring-1 ring-secondary">
      <h2 className="text-lg font-semibold text-primary">Atualizar status</h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <Select
          label="Novo status"
          className="sm:w-52"
          selectedKey={status}
          onSelectionChange={(key) => setStatus(key as StatusRastreio)}
          items={proximos.map((s) => ({ id: s, label: statusBadgeConfig("nfe", s).label }))}
        >
          {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
        </Select>
        <Input type="date" label="Data do evento" value={dataEvento} onChange={setDataEvento} isRequired className="sm:w-44" />
        <Input label="Observação" placeholder="Opcional" value={observacao} onChange={setObservacao} className="sm:flex-1" />
        <Button type="submit" color="primary" isLoading={enviando}>Registrar</Button>
      </form>
      {erro && <p className="text-sm text-error-primary">{erro}</p>}
    </div>
  );
}
