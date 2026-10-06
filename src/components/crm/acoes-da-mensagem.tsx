"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Botao } from "@/components/patterns/botao";
import { CampoTextarea } from "@/components/patterns/campo";
import { aprovarMensagem, cancelarMensagem, editarRascunho, tentarEnviar } from "@/app/(app)/conversas/actions";

/** Botões de uma mensagem nossa que ainda não saiu: rascunho (editar, aprovar, cancelar) ou aprovada esperando. */
export function AcoesDaMensagem({ id, status, texto }: { id: string; status: "RASCUNHO" | "APROVADA"; texto: string }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [retorno, setRetorno] = useState<string | null>(null);
  const [editando, setEditando] = useState(false);
  const [novoTexto, setNovoTexto] = useState(texto);
  const [erros, setErros] = useState<string[]>([]);

  async function rodar(fn: () => Promise<{ erros: string[]; status?: string; motivo?: string }>) {
    setOcupado(true);
    setRetorno(null);
    const r = await fn();
    setOcupado(false);
    if (r.erros.length) return setRetorno(r.erros[0]);
    if (r.status && r.status !== "ENVIADA") setRetorno(r.motivo ?? null);
    router.refresh();
  }

  async function salvarEdicao() {
    const r = await editarRascunho({ id, texto: novoTexto });
    if (r.erros.length) return setErros(r.erros);
    setEditando(false);
    router.refresh();
  }

  return (
    <div className="mt-2 flex flex-col items-end gap-1.5">
      <div className="flex flex-wrap justify-end gap-1.5">
        {status === "RASCUNHO" && (
          <>
            <Botao size="xs" onClick={() => setEditando(true)} disabled={ocupado}>Editar</Botao>
            <Botao size="xs" variante="primario" carregando={ocupado} onClick={() => rodar(() => aprovarMensagem({ id }))}>Aprovar e enviar</Botao>
          </>
        )}
        {status === "APROVADA" && (
          <Botao size="xs" variante="primario" carregando={ocupado} onClick={() => rodar(() => tentarEnviar({ id }))}>Tentar enviar agora</Botao>
        )}
        <Botao size="xs" variante="ghost" disabled={ocupado} onClick={() => rodar(() => cancelarMensagem({ id }))}>Cancelar</Botao>
      </div>
      {retorno && <p className="max-w-xs text-right text-xs text-muted-foreground">{retorno}</p>}

      {editando && (
        <Dialog open onOpenChange={(aberto) => !aberto && setEditando(false)}>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>Editar rascunho</DialogTitle>
              <DialogDescription>Depois de editar, você ainda precisa aprovar.</DialogDescription>
            </DialogHeader>
            <CampoTextarea rotulo="Mensagem" rows={7} value={novoTexto} onChange={(e) => setNovoTexto(e.target.value)} />
            {erros.map((e) => (
              <p key={e} className="text-sm text-destructive">{e}</p>
            ))}
            <DialogFooter>
              <Botao variante="ghost" onClick={() => setEditando(false)}>Cancelar</Botao>
              <Botao variante="primario" onClick={salvarEdicao}>Salvar</Botao>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
