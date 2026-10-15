"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import type { AlvoMovimento } from "@/components/crm/dialogo-movimento";
import { LinkDoCartao, QuadroBase } from "@/components/crm/quadro-base";
import { AvatarEmpresa } from "@/components/crm/avatar-iniciais";
import { PassoDoCartao, type PassoCartao } from "@/components/crm/passo-do-cartao";
import { Selo } from "@/components/patterns/status-badge";
import { ETAPAS_DO_QUADRO_OP, ROTULO_ETAPA_OP, ROTULO_TIPO_OP, type EtapaOportunidade, type TipoOportunidade } from "@/domain/crm/oportunidade";
import { situacaoDoPrazo } from "@/domain/crm/prazo";

const DialogoMovimento = dynamic(() => import("@/components/crm/dialogo-movimento").then((m) => m.DialogoMovimento));

export interface CartaoCarteira {
  id: string;
  clienteId: string;
  cliente: string;
  fabrica: string;
  tipo: string;
  etapa: string;
  motivoPerda: string | null;
  passo: PassoCartao;
}

// Ganha só se chega sozinha; não é destino de arraste nem do menu.
const DESTINOS: EtapaOportunidade[] = [...ETAPAS_DO_QUADRO_OP, "ADIADA", "PERDIDA"];
const rotulo = (e: string) => ROTULO_ETAPA_OP[e as EtapaOportunidade];

/** Funil da carteira: o cartão é uma oportunidade (cliente + fábrica). */
export function QuadroCarteira({
  cartoes,
  colunas,
  responsaveis,
  usuarioId,
  hoje,
}: {
  cartoes: CartaoCarteira[];
  colunas: string[];
  responsaveis: { id: string; nome: string }[];
  usuarioId: string;
  hoje: string;
}) {
  const router = useRouter();
  const [alvo, setAlvo] = useState<AlvoMovimento | null>(null);

  return (
    <>
      <QuadroBase
        colunas={colunas.map((id) => ({ id, rotulo: rotulo(id) }))}
        itens={cartoes}
        etapaDe={(c) => c.etapa}
        nomeDe={(c) => `${c.cliente} · ${c.fabrica}`}
        destinos={(c) => (c.etapa === "GANHA" ? [] : DESTINOS.filter((d) => d !== c.etapa).map((d) => ({ id: d, rotulo: rotulo(d) })))}
        aoMover={(c, para) => {
          if (c.etapa === "GANHA" || para === "GANHA") return; // a regra no servidor também recusa
          setAlvo({ id: c.id, nome: `${c.cliente} · ${c.fabrica}`, de: c.etapa, para });
        }}
        resumoDaColuna={(itens) => {
          const vencidos = itens.filter((c) => c.passo && situacaoDoPrazo(c.passo.prazo, hoje) === "atrasado").length;
          return vencidos > 0 ? `${vencidos} ${vencidos === 1 ? "vencido" : "vencidos"}` : null;
        }}
        vazio="Nenhuma oportunidade"
        renderCartao={(c) => (
          <>
            <div className="flex items-start gap-2.5 pr-8">
              <AvatarEmpresa nome={c.cliente} tamanho="sm" />
              <div className="flex min-w-0 flex-col gap-1">
                <LinkDoCartao href={`/empresas/${c.clienteId}`}>{c.cliente}</LinkDoCartao>
                <div className="flex flex-wrap items-center gap-1">
                  <Selo cor="blue">{c.fabrica}</Selo>
                  <span className="text-xs text-muted-foreground">{ROTULO_TIPO_OP[c.tipo as TipoOportunidade]}</span>
                </div>
              </div>
            </div>
            {c.etapa === "PERDIDA" && c.motivoPerda ? (
              <p className="text-xs text-muted-foreground">Motivo: {c.motivoPerda}</p>
            ) : c.etapa === "GANHA" ? (
              <p className="text-xs font-medium text-success">Chegou pedido</p>
            ) : (
              <PassoDoCartao passo={c.passo} hoje={hoje} cobrar={c.etapa !== "A_ABORDAR" && c.etapa !== "ADIADA"} semPasso={c.etapa === "A_ABORDAR" ? "Ainda não abordado" : "Sem próximo passo marcado"} />
            )}
          </>
        )}
      />
      {alvo && (
        <DialogoMovimento
          modo="oportunidade"
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
