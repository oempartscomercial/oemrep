"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { Botao } from "@/components/patterns/botao";
import { atualizarRastreioAgora, atualizarTodosRastreiosAgora } from "./actions";

/** Consulta a transportadora na hora (de uma nota ou de todas em trânsito). */
export function BotaoAtualizarRastreio({ notaFiscalId, rotulo = "Atualizar agora" }: { notaFiscalId?: string; rotulo?: string }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  async function atualizar() {
    setOcupado(true);
    const r = notaFiscalId ? await atualizarRastreioAgora(notaFiscalId) : await atualizarTodosRastreiosAgora();
    setOcupado(false);
    if (r.erros.length) return toast.error(r.erros[0]);
    if (r.mensagem) toast(r.mensagem);
    router.refresh();
  }
  return (
    <Botao className="h-11 md:h-8" icone={<RefreshCw />} carregando={ocupado} onClick={atualizar}>
      {ocupado ? "Consultando…" : rotulo}
    </Botao>
  );
}
