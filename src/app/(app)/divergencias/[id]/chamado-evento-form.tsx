"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { registrarEventoChamado } from "../actions";
import type { EstadoChamado } from "@/domain/chamado/estado";
import { statusBadgeConfig } from "@/components/patterns/status-badge.config";
import { Botao } from "@/components/patterns/botao";
import { CampoSelect, CampoTextarea } from "@/components/patterns/campo";

export function ChamadoEventoForm({
  chamadoId,
  proximos,
}: {
  chamadoId: string;
  proximos: EstadoChamado[];
}) {
  const router = useRouter();
  const [estado, setEstado] = useState<EstadoChamado>(proximos[0]);
  const [observacao, setObservacao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setErro(null);
    const resultado = await registrarEventoChamado(chamadoId, estado, observacao);
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
      <h2 className="text-sm font-semibold">Registrar andamento</h2>
      <form onSubmit={handleSubmit} className="flex max-w-xl flex-col gap-4">
        <CampoSelect
          name="estado"
          rotulo="Novo estado"
          className="sm:w-64"
          valor={estado}
          aoMudar={(valor) => setEstado(valor as EstadoChamado)}
          opcoes={proximos.map((s) => ({ id: s, label: statusBadgeConfig("chamado", s).label }))}
        />
        <CampoTextarea
          name="observacao"
          rotulo="Observação"
          placeholder="Descreva o andamento (obrigatório)"
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          obrigatorio
          rows={2}
        />
        <div>
          <Botao type="submit" variante="primario" carregando={enviando}>Registrar</Botao>
        </div>
      </form>
      {erro && <p className="text-sm text-destructive">{erro}</p>}
    </div>
  );
}
