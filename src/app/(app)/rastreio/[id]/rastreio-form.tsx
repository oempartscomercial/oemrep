"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { avancarRastreio } from "../actions";
import type { StatusRastreio } from "@/domain/nfe/rastreio";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
    <Card>
      <CardHeader>
        <CardTitle>Atualizar status</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
          <select
            className="rounded-md border px-2 py-1 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusRastreio)}
          >
            {proximos.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <Input
            type="date"
            value={dataEvento}
            onChange={(e) => setDataEvento(e.target.value)}
            required
          />
          <Input
            placeholder="Observação (opcional)"
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
          />
          <Button type="submit" disabled={enviando}>
            Registrar
          </Button>
        </form>
        {erro && <p className="mt-2 text-sm text-destructive">{erro}</p>}
      </CardContent>
    </Card>
  );
}
