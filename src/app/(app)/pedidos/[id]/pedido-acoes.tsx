"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { arquivarPedido, reabrirPedido } from "./actions";
import { Botao } from "@/components/patterns/botao";
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
      {estado === "COMPLETO" && <Botao variante="secundario" type="button" onClick={handleArquivar}>Arquivar</Botao>}
      {estado === "ARQUIVADO" && <Botao variante="secundario" type="button" onClick={handleReabrir}>Reabrir</Botao>}
      {erro && <p className="text-xs text-destructive">{erro}</p>}
    </div>
  );
}
