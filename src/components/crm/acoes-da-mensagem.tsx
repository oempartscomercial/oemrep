"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Botao } from "@/components/patterns/botao";
import { CampoTextarea } from "@/components/patterns/campo";
import { aprovarMensagem, cancelarMensagem, editarRascunho, tentarEnviar } from "@/app/(app)/conversas/actions";

/** Segundos entre confirmar e a mensagem sair de verdade: dá tempo de desfazer. */
const SEGUNDOS_PARA_DESFAZER = 10;

export type DestinatarioDaMensagem = { nome: string; numero: string };

type Props = {
  id: string;
  status: "RASCUNHO" | "APROVADA";
  texto: string;
  /** Para quem vai: aparece na confirmação antes de enviar. */
  destinatario?: DestinatarioDaMensagem;
  /** O que a pessoa disse por último, para quem aprova lembrar do que está respondendo. */
  ultimaRecebida?: string | null;
};

/** Botões de uma mensagem nossa que ainda não saiu: rascunho (editar, aprovar, descartar) ou aprovada esperando. */
export function AcoesDaMensagem({ id, status, texto, destinatario, ultimaRecebida }: Props) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [retorno, setRetorno] = useState<string | null>(null);
  const [editando, setEditando] = useState(false);
  const [novoTexto, setNovoTexto] = useState(texto);
  const [erros, setErros] = useState<string[]>([]);
  const [confirmando, setConfirmando] = useState(false);
  const [descartando, setDescartando] = useState(false);
  const [contagem, setContagem] = useState<number | null>(null);

  async function rodar(fn: () => Promise<{ erros: string[]; status?: string; motivo?: string }>) {
    setOcupado(true);
    setRetorno(null);
    const r = await fn();
    setOcupado(false);
    if (r.erros.length) return setRetorno(r.erros[0]);
    if (r.status && r.status !== "ENVIADA") setRetorno(r.motivo ?? null);
    router.refresh();
  }

  // Depois de confirmar, a mensagem só sai quando a contagem chega a zero. Sair da tela cancela o envio (nada foi aprovado ainda).
  useEffect(() => {
    if (contagem === null) return;
    const t = setTimeout(() => {
      if (contagem <= 1) {
        setContagem(null);
        void rodar(() => aprovarMensagem({ id }));
      } else {
        setContagem(contagem - 1);
      }
    }, 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contagem]);

  async function salvarEdicao() {
    const r = await editarRascunho({ id, texto: novoTexto });
    if (r.erros.length) return setErros(r.erros);
    setEditando(false);
    router.refresh();
  }

  async function descartar() {
    setDescartando(false);
    await rodar(() => cancelarMensagem({ id }));
  }

  const nome = destinatario?.nome ?? "o contato";
  const emContagem = contagem !== null;

  return (
    <div className="mt-2 flex flex-col items-end gap-1.5">
      {emContagem ? (
        <div className="flex flex-wrap items-center justify-end gap-2" role="status">
          <p className="text-sm font-medium">Enviando para {nome} em {contagem}s…</p>
          <Botao size="xs" className="h-11 md:h-6" onClick={() => setContagem(null)}>Desfazer</Botao>
          <p className="w-full text-right text-xs text-muted-foreground">Fique nesta tela até enviar. Se sair, nada é enviado.</p>
        </div>
      ) : (
        <div className="flex w-full flex-wrap items-center justify-between gap-1.5">
          <Botao size="xs" className="h-11 md:h-6 text-destructive hover:text-destructive" variante="ghost" disabled={ocupado} onClick={() => setDescartando(true)}>
            {status === "RASCUNHO" ? "Descartar rascunho" : "Cancelar envio"}
          </Botao>
          <div className="flex flex-wrap justify-end gap-1.5">
            {status === "RASCUNHO" && (
              <>
                <Botao size="xs" className="h-11 md:h-6" onClick={() => setEditando(true)} disabled={ocupado}>Editar</Botao>
                <Botao size="xs" className="h-11 md:h-6" variante="primario" carregando={ocupado} onClick={() => setConfirmando(true)}>Aprovar e enviar</Botao>
              </>
            )}
            {status === "APROVADA" && (
              <Botao size="xs" className="h-11 md:h-6" variante="primario" carregando={ocupado} onClick={() => rodar(() => tentarEnviar({ id }))}>Tentar enviar agora</Botao>
            )}
          </div>
        </div>
      )}
      {retorno && <p role="alert" className="max-w-xs text-right text-xs font-medium text-warning">{retorno}</p>}

      {confirmando && (
        <Dialog open onOpenChange={(aberto) => !aberto && setConfirmando(false)}>
          <DialogContent className="sm:max-w-xl max-md:max-h-[calc(100dvh-2rem)] max-md:overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Enviar para {nome}?</DialogTitle>
              <DialogDescription>{destinatario ? `WhatsApp ${destinatario.numero}. ` : ""}Você ainda poderá desfazer por {SEGUNDOS_PARA_DESFAZER} segundos.</DialogDescription>
            </DialogHeader>
            {ultimaRecebida && (
              <div className="rounded-md border bg-card px-3 py-2 text-sm">
                <p className="text-xs font-medium text-muted-foreground">{nome} disse por último</p>
                <p className="whitespace-pre-wrap break-words">{ultimaRecebida}</p>
              </div>
            )}
            <div className="rounded-md border border-dashed border-warning/60 bg-warning-soft px-3 py-2 text-sm">
              <p className="text-xs font-medium text-warning">Sua mensagem</p>
              <p className="whitespace-pre-wrap break-words">{texto}</p>
            </div>
            <DialogFooter>
              <Botao variante="ghost" className="h-11 md:h-8" onClick={() => setConfirmando(false)}>Voltar</Botao>
              <Botao
                variante="primario"
                className="h-11 md:h-8"
                onClick={() => {
                  setConfirmando(false);
                  setContagem(SEGUNDOS_PARA_DESFAZER);
                }}
              >
                Enviar para {nome}
              </Botao>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {descartando && (
        <Dialog open onOpenChange={(aberto) => !aberto && setDescartando(false)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{status === "RASCUNHO" ? "Descartar este rascunho?" : "Cancelar este envio?"}</DialogTitle>
              <DialogDescription>A mensagem não será enviada e sai da fila. Se quiser, escreva outra depois.</DialogDescription>
            </DialogHeader>
            <p className="whitespace-pre-wrap break-words rounded-md border bg-card px-3 py-2 text-sm">{texto}</p>
            <DialogFooter>
              <Botao variante="ghost" className="h-11 md:h-8" onClick={() => setDescartando(false)}>Manter</Botao>
              <Botao variante="destrutivo" className="h-11 md:h-8" onClick={descartar}>{status === "RASCUNHO" ? "Descartar" : "Cancelar envio"}</Botao>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {editando && (
        <Dialog open onOpenChange={(aberto) => !aberto && setEditando(false)}>
          <DialogContent className="sm:max-w-xl max-md:max-h-[calc(100dvh-2rem)] max-md:overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Editar rascunho</DialogTitle>
              <DialogDescription>Depois de editar, você ainda precisa aprovar.</DialogDescription>
            </DialogHeader>
            <CampoTextarea rotulo="Mensagem" rows={7} value={novoTexto} onChange={(e) => setNovoTexto(e.target.value)} />
            {erros.map((e) => (
              <p key={e} className="text-sm text-destructive">{e}</p>
            ))}
            <DialogFooter>
              <Botao variante="ghost" className="h-11 md:h-8" onClick={() => setEditando(false)}>Fechar</Botao>
              <Botao variante="primario" className="h-11 md:h-8" onClick={salvarEdicao}>Salvar</Botao>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
