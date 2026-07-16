"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { registrarEventoChamado } from "../actions";
import type { EstadoChamado } from "@/domain/chamado/estado";
import { statusBadgeConfig } from "@/components/patterns/status-badge.config";
import { Button } from "@/components/ui/buttons/button";
import { Select } from "@/components/ui/select/select";
import { TextArea } from "@/components/ui/textarea/textarea";

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
    <div className="flex flex-col gap-4 rounded-xl bg-primary p-6 ring-1 ring-secondary">
      <h2 className="text-lg font-semibold text-primary">Registrar andamento</h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <Select
          label="Novo estado"
          className="sm:w-64"
          selectedKey={estado}
          onSelectionChange={(key) => setEstado(key as EstadoChamado)}
          items={proximos.map((s) => ({ id: s, label: statusBadgeConfig("chamado", s).label }))}
        >
          {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
        </Select>
        <TextArea
          label="Observação"
          placeholder="Descreva o andamento (obrigatório)"
          value={observacao}
          onChange={setObservacao}
          isRequired
          rows={2}
        />
        <div>
          <Button type="submit" color="primary" isLoading={enviando}>Registrar</Button>
        </div>
      </form>
      {erro && <p className="text-sm text-error-primary">{erro}</p>}
    </div>
  );
}
