"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DialogoMovimento, type AlvoMovimento } from "@/components/crm/dialogo-movimento";
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
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [sobre, setSobre] = useState<string | null>(null);
  const [alvo, setAlvo] = useState<AlvoMovimento | null>(null);

  const mover = (cartao: CartaoFunil, para: string) => {
    if (cartao.situacao === para) return;
    setAlvo({ clienteId: cartao.id, nome: cartao.nome, de: cartao.situacao, para });
  };

  return (
    <>
      <div className="grid auto-cols-[minmax(15rem,1fr)] grid-flow-col gap-3 overflow-x-auto pb-2">
        {colunas.map((coluna) => {
          const doGrupo = cartoes.filter((c) => c.situacao === coluna);
          return (
            <section
              key={coluna}
              aria-label={ROTULO_SITUACAO[coluna as Situacao]}
              onDragOver={(e) => {
                e.preventDefault();
                setSobre(coluna);
              }}
              onDragLeave={() => setSobre((atual) => (atual === coluna ? null : atual))}
              onDrop={(e) => {
                e.preventDefault();
                setSobre(null);
                const cartao = cartoes.find((c) => c.id === e.dataTransfer.getData("text/plain") || c.id === arrastando);
                if (cartao) mover(cartao, coluna);
                setArrastando(null);
              }}
              className={cn("flex min-h-64 flex-col rounded-lg border bg-muted/40 transition-colors", sobre === coluna && "border-foreground/40 bg-muted")}
            >
              <header className="flex items-center justify-between px-3 py-2">
                <h2 className="text-xs font-medium">{ROTULO_SITUACAO[coluna as Situacao]}</h2>
                <span className="tabular text-xs text-muted-foreground">{doGrupo.length}</span>
              </header>
              <ul className="flex flex-1 flex-col gap-2 px-2 pb-2">
                {doGrupo.map((c) => (
                  <li
                    key={c.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", c.id);
                      e.dataTransfer.effectAllowed = "move";
                      setArrastando(c.id);
                    }}
                    onDragEnd={() => {
                      setArrastando(null);
                      setSobre(null);
                    }}
                    className={cn("cursor-grab rounded-md border bg-card p-2.5 shadow-xs active:cursor-grabbing", arrastando === c.id && "opacity-40")}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <Link href={`/empresas/${c.id}`} className="min-w-0 text-sm font-medium leading-tight hover:underline">
                        {c.nome}
                      </Link>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button type="button" aria-label={`Mover ${c.nome} para…`} className="-mt-0.5 -mr-1 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
                            <MoreHorizontal className="size-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {DESTINOS.filter((d) => d !== c.situacao).map((d) => (
                            <DropdownMenuItem key={d} onSelect={() => mover(c, d)}>
                              Mover para {ROTULO_SITUACAO[d]}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
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
                  </li>
                ))}
                {doGrupo.length === 0 && <li className="px-1 py-6 text-center text-xs text-muted-foreground">Nenhuma empresa</li>}
              </ul>
            </section>
          );
        })}
      </div>

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
