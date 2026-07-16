"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { arquivarPedido, reabrirPedido } from "./actions";
import { Button } from "@/components/ui/buttons/button";
import type { EstadoPedido } from "@/domain/pedido/estado";

export function PedidoAcoes({ pedidoId, estado }: { pedidoId: string; estado: EstadoPedido }) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);

  async function handleArquivar() {
    const resultado = await arquivarPedido(pedidoId);
    if (resultado.erros.length > 0) setErro(resultado.erros.join(" "));
    else router.refresh();
  }

  async function handleReabrir() {
    const resultado = await reabrirPedido(pedidoId);
    if (resultado.erros.length > 0) setErro(resultado.erros.join(" "));
    else router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      {estado === "COMPLETO" && <Button color="secondary" onClick={handleArquivar}>Arquivar</Button>}
      {estado === "ARQUIVADO" && <Button color="secondary" onClick={handleReabrir}>Reabrir</Button>}
      {erro && <p className="text-xs text-error-primary">{erro}</p>}
    </div>
  );
}
