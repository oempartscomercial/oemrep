"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, MessageCircle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Botao } from "@/components/patterns/botao";
import { marcarComoEnviada } from "@/app/(app)/conversas/actions";

export const AVISO_SEM_ENVIO_AUTOMATICO = "O envio automático não está ligado. Abra no WhatsApp do celular de prospecção, envie e toque em Já enviei.";

type Props = {
  id: string;
  /** Link wa.me com o número e o texto prontos. */
  link: string;
  /** Para quem vai: aparece na confirmação. */
  nome: string;
  envioAutomatico: boolean;
  /** Depois de registrar (ex.: fechar o compositor). */
  aoMarcar?: () => void;
};

/**
 * Envio manual assistido: abre a conversa no WhatsApp do celular e, depois, "Já enviei".
 * Com o envio automático ligado não aparece: a aprovada sai sozinha e enviar também pelo
 * celular faria a mensagem chegar duas vezes.
 */
export function EnvioPeloCelular(props: Props) {
  if (props.envioAutomatico) return null;
  return <EnvioManual {...props} />;
}

function EnvioManual({ id, link, nome, aoMarcar }: Props) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);

  async function marcar() {
    setConfirmando(false);
    setOcupado(true);
    setErro(null);
    const r = await marcarComoEnviada({ id });
    setOcupado(false);
    if (r.erros.length) return setErro(r.erros[0]);
    router.refresh();
    aoMarcar?.();
  }

  return (
    <div className="flex w-full flex-col items-end gap-1.5">
      <p className="max-w-sm text-right text-xs text-muted-foreground">{AVISO_SEM_ENVIO_AUTOMATICO}</p>
      <div className="flex flex-wrap justify-end gap-1.5">
        <Botao size="xs" className="h-11 md:h-6" variante="primario" icone={<MessageCircle />} href={link} novaAba>
          Abrir no WhatsApp
        </Botao>
        <Botao size="xs" className="h-11 md:h-6" icone={<Check />} carregando={ocupado} onClick={() => setConfirmando(true)}>
          Já enviei
        </Botao>
      </div>
      {erro && <p role="alert" className="max-w-xs text-right text-xs font-medium text-destructive">{erro}</p>}

      {confirmando && (
        <Dialog open onOpenChange={(aberto) => !aberto && setConfirmando(false)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Você já enviou para {nome}?</DialogTitle>
              <DialogDescription>Toque em &quot;Sim, já enviei&quot; só depois de enviar pelo celular. O envio fica anotado na ficha da empresa.</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Botao variante="ghost" className="h-11 md:h-8" onClick={() => setConfirmando(false)}>Ainda não</Botao>
              <Botao variante="primario" className="h-11 md:h-8" onClick={marcar}>Sim, já enviei</Botao>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
