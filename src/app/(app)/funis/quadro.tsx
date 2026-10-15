"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { MapPin } from "lucide-react";
import type { AlvoMovimento } from "@/components/crm/dialogo-movimento";
import { LinkDoCartao, QuadroBase } from "@/components/crm/quadro-base";
import { AvatarEmpresa } from "@/components/crm/avatar-iniciais";
import { PassoDoCartao, type PassoCartao } from "@/components/crm/passo-do-cartao";
import { Selo } from "@/components/patterns/status-badge";
import { ETAPAS_ATIVAS, ETAPAS_DO_QUADRO, ROTULO_SITUACAO, type Situacao } from "@/domain/crm/funil";
import { descreverPrazo, situacaoDoPrazo } from "@/domain/crm/prazo";

// A janelinha de mover só é baixada quando alguém move um cartão.
const DialogoMovimento = dynamic(() => import("@/components/crm/dialogo-movimento").then((m) => m.DialogoMovimento));

export interface CartaoFunil {
  id: string;
  nome: string;
  local: string;
  /** Prospecção Rudolph só no Norte e Nordeste (regra do contrato). */
  foraDaRegiao: boolean;
  situacao: string;
  passo: PassoCartao;
  ultimoContato: string | null;
  naoContatar: boolean;
}

const DESTINOS: Situacao[] = [...ETAPAS_DO_QUADRO, "PAUSADA", "DESCARTADA"];
const ATIVAS = new Set<string>(ETAPAS_ATIVAS);

/** Funil de prospecção: o cartão é a empresa. */
export function Quadro({
  cartoes,
  colunas,
  responsaveis,
  usuarioId,
  hoje,
}: {
  cartoes: CartaoFunil[];
  colunas: string[];
  responsaveis: { id: string; nome: string }[];
  usuarioId: string;
  hoje: string;
}) {
  const router = useRouter();
  const [alvo, setAlvo] = useState<AlvoMovimento | null>(null);
  const rotulo = (s: string) => ROTULO_SITUACAO[s as Situacao];

  return (
    <>
      <QuadroBase
        colunas={colunas.map((id) => ({ id, rotulo: rotulo(id) }))}
        itens={cartoes}
        etapaDe={(c) => c.situacao}
        nomeDe={(c) => c.nome}
        destinos={(c) => DESTINOS.filter((d) => d !== c.situacao).map((d) => ({ id: d, rotulo: rotulo(d) }))}
        aoMover={(c, para) => setAlvo({ id: c.id, nome: c.nome, de: c.situacao, para })}
        resumoDaColuna={(itens) => {
          const vencidos = itens.filter((c) => c.passo && situacaoDoPrazo(c.passo.prazo, hoje) === "atrasado").length;
          return vencidos > 0 ? `${vencidos} ${vencidos === 1 ? "vencido" : "vencidos"}` : null;
        }}
        vazio="Nenhuma empresa"
        renderCartao={(c) => (
          <>
            <div className="flex items-start gap-2.5 pr-8">
              <AvatarEmpresa nome={c.nome} tamanho="sm" />
              <div className="flex min-w-0 flex-col gap-0.5">
                <LinkDoCartao href={`/empresas/${c.id}`}>{c.nome}</LinkDoCartao>
                {c.local && (
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="size-3 shrink-0" aria-hidden />
                    <span className="truncate">{c.local}</span>
                  </p>
                )}
              </div>
            </div>
            {(c.foraDaRegiao || c.naoContatar) && (
              <div className="flex flex-wrap gap-1">
                {c.naoContatar && <Selo cor="error">Não contatar</Selo>}
                {c.foraDaRegiao && <Selo cor="warning">Fora do Norte/Nordeste</Selo>}
              </div>
            )}
            <PassoDoCartao
              passo={c.passo}
              hoje={hoje}
              cobrar={ATIVAS.has(c.situacao)}
              semPasso={c.situacao === "CANDIDATA" ? "Esperando sua avaliação" : ATIVAS.has(c.situacao) ? "Sem próximo passo marcado" : "Sem próximo passo"}
            />
            {c.ultimoContato && <p className="text-xs text-muted-foreground">Último registro {descreverPrazo(c.ultimoContato, hoje)}</p>}
          </>
        )}
      />
      {alvo && (
        <DialogoMovimento
          alvo={alvo}
          responsaveis={responsaveis}
          usuarioId={usuarioId}
          aoFechar={(movido) => {
            setAlvo(null);
            if (movido) router.refresh();
          }}
        />
      )}
    </>
  );
}
