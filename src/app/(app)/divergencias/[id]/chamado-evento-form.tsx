"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { registrarEventoChamado } from "../actions";
import type { EstadoChamado } from "@/domain/chamado/estado";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
    <Card>
      <CardHeader>
        <CardTitle>Registrar andamento</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          <div className="flex flex-wrap items-end gap-2">
            <select
              className="rounded-md border px-2 py-1 text-sm"
              value={estado}
              onChange={(e) => setEstado(e.target.value as EstadoChamado)}
            >
              {proximos.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <Button type="submit" disabled={enviando}>
              Registrar
            </Button>
          </div>
          <textarea
            className="rounded-md border px-2 py-1 text-sm"
            placeholder="Observação (obrigatória)"
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            required
            rows={2}
          />
        </form>
        {erro && <p className="mt-2 text-sm text-destructive">{erro}</p>}
      </CardContent>
    </Card>
  );
}
