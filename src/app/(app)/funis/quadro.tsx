"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DialogoMovimento, type AlvoMovimento } from "@/components/crm/dialogo-movimento";
import { QuadroBase } from "@/components/crm/quadro-base";
import { ETAPAS_DO_QUADRO, ROTULO_SITUACAO, type Situacao } from "@/domain/crm/funil";
import { cn } from "@/lib/utils";

export interface CartaoFunil {
  id: string;
  nome: string;
  local: string;
  situacao: string;
  fabricas: string[];
  passo: { acao: string; quando: string; atrasado: boolean; responsavel: string } | null;
  naoContatar: boolean;
}

const DESTINOS: Situacao[] = [...ETAPAS_DO_QUADRO, "PAUSADA", "DESCARTADA"];

/** Funil de prospecção: o cartão é a empresa. */
export function Quadro({
  cartoes,
  colunas,
  responsaveis,
  usuarioId,
}: {
  cartoes: CartaoFunil[];
  colunas: string[];
  responsaveis: { id: string; nome: string }[];
  usuarioId: string;
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
        vazio="Nenhuma empresa"
        renderCartao={(c) => (
          <>
            <Link href={`/empresas/${c.id}`} className="block pr-6 text-sm leading-tight font-medium hover:underline">
              {c.nome}
            </Link>
            {c.local && <p className="text-xs text-muted-foreground">{c.local}</p>}
            {c.passo ? (
              <p className="mt-1.5 text-xs leading-snug">
                <span>{c.passo.acao}</span>
                <span className={cn("block", c.passo.atrasado ? "font-medium text-destructive" : "text-muted-foreground")}>
                  {c.passo.quando} · {c.passo.responsavel}
                </span>
              </p>
            ) : (
              <p className="mt-1.5 text-xs text-muted-foreground">Sem próximo passo</p>
            )}
            {c.naoContatar && <p className="mt-1 text-xs font-medium text-destructive">Não contatar</p>}
          </>
        )}
      />
      <DialogoMovimento
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
