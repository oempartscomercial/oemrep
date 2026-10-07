"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Botao } from "@/components/patterns/botao";
import { CampoSelect, CampoTexto } from "@/components/patterns/campo";
import { ComporMensagem } from "@/components/crm/compor-mensagem";
import { definirOrigemContato, marcarNaoContatar, reativarContato } from "@/app/(app)/conversas/actions";

const ORIGENS = [
  { id: "PUBLICADO_PELA_EMPRESA", label: "Publicado pela empresa" },
  { id: "INDICACAO", label: "Indicação" },
  { id: "BASE_PROFISSIONAL", label: "Base profissional" },
  { id: "RELACIONAMENTO", label: "Já tínhamos relação" },
];

/** Origem do número (sem ela nada é enviado), botão de escrever e, se foi suprimido, de reativar. */
export function ContatoAcoes({
  contatoId,
  nome,
  origem,
  naoContatar,
  podeEscrever,
}: {
  contatoId: string;
  nome: string;
  origem: string | null;
  naoContatar: boolean;
  podeEscrever: boolean;
}) {
  const router = useRouter();
  const [escrevendo, setEscrevendo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [marcando, setMarcando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [ocupadoNaoContatar, setOcupadoNaoContatar] = useState(false);
  const [erroNaoContatar, setErroNaoContatar] = useState<string | null>(null);

  async function mudarOrigem(valor: string) {
    const r = await definirOrigemContato({ contatoId, origem: valor });
    setErro(r.erros[0] ?? null);
    router.refresh();
  }
  async function reativar() {
    const r = await reativarContato({ contatoId });
    setErro(r.erros[0] ?? null);
    router.refresh();
  }
  function fecharNaoContatar() {
    setMarcando(false);
    setMotivo("");
    setErroNaoContatar(null);
  }
  async function confirmarNaoContatar() {
    setOcupadoNaoContatar(true);
    setErroNaoContatar(null);
    try {
      const r = await marcarNaoContatar({ contatoId, motivo });
      if (r.erros.length > 0) {
        setErroNaoContatar(r.erros[0]);
        return;
      }
      fecharNaoContatar();
      router.refresh();
    } catch {
      setErroNaoContatar("Não foi possível marcar agora. Tente de novo.");
    } finally {
      setOcupadoNaoContatar(false);
    }
  }

  return (
    <div className="mt-1.5 flex flex-col gap-1.5">
      {podeEscrever && (
        <CampoSelect
          ariaLabel="De onde veio o número"
          placeholder="De onde veio o número?"
          opcoes={ORIGENS}
          valor={origem ?? undefined}
          aoMudar={mudarOrigem}
        />
      )}
      <div className="flex flex-wrap gap-1.5">
        {podeEscrever && !naoContatar && (
          <Botao size="xs" className="h-11 md:h-6" icone={<MessageCircle />} onClick={() => setEscrevendo(true)}>Escrever no WhatsApp</Botao>
        )}
        {podeEscrever && !naoContatar && (
          <Botao size="xs" variante="secundario" className="h-11 md:h-6" onClick={() => setMarcando(true)}>Não contatar</Botao>
        )}
        {naoContatar && <Botao size="xs" className="h-11 md:h-6" onClick={reativar}>Reativar contato</Botao>}
      </div>
      {erro && <p className="text-xs text-destructive">{erro}</p>}
      {escrevendo && <ComporMensagem contatoId={contatoId} nome={nome} aoFechar={() => setEscrevendo(false)} />}
      {marcando && (
        <Dialog open onOpenChange={(aberto) => !aberto && fecharNaoContatar()}>
          <DialogContent className="sm:max-w-md max-md:max-h-[calc(100dvh-2rem)] max-md:overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Não contatar</DialogTitle>
              <DialogDescription>
                Marcar {nome} como &apos;não contatar&apos;? As mensagens pendentes serão canceladas e nada mais será enviado para este contato. Só uma pessoa pode desfazer.
              </DialogDescription>
            </DialogHeader>
            <CampoTexto
              rotulo="Motivo (opcional)"
              placeholder="Ex.: pediu por WhatsApp para parar"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              maxLength={300}
            />
            {erroNaoContatar && <p className="text-sm text-destructive">{erroNaoContatar}</p>}
            <DialogFooter>
              <Botao variante="ghost" className="h-11 md:h-8" onClick={fecharNaoContatar}>Cancelar</Botao>
              <Botao variante="primario" className="h-11 md:h-8" carregando={ocupadoNaoContatar} onClick={confirmarNaoContatar}>
                Confirmar
              </Botao>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

/** Botão avulso para abrir o compositor (listas fora da ficha). */
export function BotaoEscrever({ contatoId, nome, rotulo }: { contatoId: string; nome: string; rotulo: string }) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <Botao size="xs" className="h-11 md:h-6" icone={<MessageCircle />} onClick={() => setAberto(true)}>{rotulo}</Botao>
      {aberto && <ComporMensagem contatoId={contatoId} nome={nome} aoFechar={() => setAberto(false)} />}
    </>
  );
}
