"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { Botao } from "@/components/patterns/botao";
import { CampoSelect } from "@/components/patterns/campo";
import { ComporMensagem } from "@/components/crm/compor-mensagem";
import { definirOrigemContato, reativarContato } from "@/app/(app)/conversas/actions";

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
          <Botao size="xs" icone={<MessageCircle />} onClick={() => setEscrevendo(true)}>Escrever no WhatsApp</Botao>
        )}
        {naoContatar && <Botao size="xs" onClick={reativar}>Reativar contato</Botao>}
      </div>
      {erro && <p className="text-xs text-destructive">{erro}</p>}
      {escrevendo && <ComporMensagem contatoId={contatoId} nome={nome} aoFechar={() => setEscrevendo(false)} />}
    </div>
  );
}

/** Botão avulso para abrir o compositor (listas fora da ficha). */
export function BotaoEscrever({ contatoId, nome, rotulo }: { contatoId: string; nome: string; rotulo: string }) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <Botao size="xs" icone={<MessageCircle />} onClick={() => setAberto(true)}>{rotulo}</Botao>
      {aberto && <ComporMensagem contatoId={contatoId} nome={nome} aoFechar={() => setAberto(false)} />}
    </>
  );
}
