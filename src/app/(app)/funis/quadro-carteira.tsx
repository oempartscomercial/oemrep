"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DialogoMovimento, type AlvoMovimento } from "@/components/crm/dialogo-movimento";
import { QuadroBase } from "@/components/crm/quadro-base";
import { Selo } from "@/components/patterns/status-badge";
import { ETAPAS_DO_QUADRO_OP, ROTULO_ETAPA_OP, ROTULO_TIPO_OP, type EtapaOportunidade, type TipoOportunidade } from "@/domain/crm/oportunidade";
import { cn } from "@/lib/utils";

export interface CartaoCarteira {
  id: string;
  clienteId: string;
  cliente: string;
  fabrica: string;
  tipo: string;
  etapa: string;
  motivoPerda: string | null;
  passo: { acao: string; quando: string; atrasado: boolean; responsavel: string } | null;
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
}: {
  cartoes: CartaoCarteira[];
  colunas: string[];
  responsaveis: { id: string; nome: string }[];
  usuarioId: string;
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
        vazio="Nenhuma oportunidade"
        renderCartao={(c) => (
          <>
            <Link href={`/empresas/${c.clienteId}`} className="block pr-6 text-sm leading-tight font-medium hover:underline">
              {c.cliente}
            </Link>
            <div className="mt-1 flex flex-wrap items-center gap-1">
              <Selo cor="blue">{c.fabrica}</Selo>
              <span className="text-xs text-muted-foreground">{ROTULO_TIPO_OP[c.tipo as TipoOportunidade]}</span>
            </div>
            {c.passo ? (
              <p className="mt-1.5 text-xs leading-snug">
                <span>{c.passo.acao}</span>
                <span className={cn("block", c.passo.atrasado ? "font-medium text-destructive" : "text-muted-foreground")}>
                  {c.passo.quando} · {c.passo.responsavel}
                </span>
              </p>
            ) : c.etapa === "PERDIDA" && c.motivoPerda ? (
              <p className="mt-1.5 text-xs text-muted-foreground">Motivo: {c.motivoPerda}</p>
            ) : c.etapa === "GANHA" ? (
              <p className="mt-1.5 text-xs text-success">Chegou pedido</p>
            ) : (
              <p className="mt-1.5 text-xs text-muted-foreground">{c.etapa === "A_ABORDAR" ? "Ainda não abordado" : "Sem próximo passo"}</p>
            )}
          </>
        )}
      />
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
    </>
  );
}
