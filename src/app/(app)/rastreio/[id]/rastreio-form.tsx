"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { avancarRastreio } from "../actions";
import type { StatusRastreio } from "@/domain/nfe/rastreio";
import { statusBadgeConfig } from "@/components/patterns/status-badge.config";
import { Botao } from "@/components/patterns/botao";
import { CampoSelect, CampoTexto } from "@/components/patterns/campo";

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
    <div className="flex flex-col gap-4 rounded-lg border bg-card p-4">
      <h2 className="text-sm font-semibold">Atualizar status</h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <CampoSelect
          name="status"
          rotulo="Novo status"
          className="sm:w-52"
          valor={status}
          aoMudar={(valor) => setStatus(valor as StatusRastreio)}
          opcoes={proximos.map((s) => ({ id: s, label: statusBadgeConfig("nfe", s).label }))}
        />
        <CampoTexto
          name="dataEvento"
          type="date"
          rotulo="Data do evento"
          value={dataEvento}
          onChange={(e) => setDataEvento(e.target.value)}
          obrigatorio
          className="sm:w-44"
        />
        <CampoTexto
          name="observacao"
          rotulo="Observação"
          placeholder="Opcional"
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          className="sm:flex-1"
        />
        <Botao type="submit" variante="primario" carregando={enviando}>Registrar</Botao>
      </form>
      {erro && <p className="text-sm text-destructive">{erro}</p>}
    </div>
  );
}
