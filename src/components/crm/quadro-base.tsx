"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PONTO_DA_ETAPA } from "@/components/crm/selo-situacao";
import { cn } from "@/lib/utils";

export type ColunaQuadro = { id: string; rotulo: string };

/** Link que cobre o cartão inteiro: o clique em qualquer ponto abre a empresa. */
export function LinkDoCartao({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <Link href={href} draggable={false} className={cn("rounded-sm text-sm leading-snug font-semibold outline-none after:absolute after:inset-0 after:rounded-lg focus-visible:after:ring-2 focus-visible:after:ring-ring", className)}>
      {children}
    </Link>
  );
}

/**
 * Quadro de cartões com arraste (HTML5) para os dois funis. Cada cartão também tem o menu
 * "Mover para…", que é o caminho no celular. Soltar não move: só chama `aoMover`, que abre a
 * janelinha de confirmação; cancelar deixa o cartão onde estava.
 */
export function QuadroBase<T extends { id: string }>({
  colunas,
  itens,
  etapaDe,
  nomeDe,
  destinos,
  renderCartao,
  resumoDaColuna,
  aoMover,
  vazio = "Nenhum cartão",
}: {
  colunas: ColunaQuadro[];
  itens: T[];
  etapaDe: (item: T) => string;
  nomeDe: (item: T) => string;
  destinos: (item: T) => ColunaQuadro[];
  renderCartao: (item: T) => ReactNode;
  /** Texto curto ao lado da contagem (ex.: "2 vencidos"). */
  resumoDaColuna?: (itens: T[]) => string | null;
  aoMover: (item: T, para: string) => void;
  vazio?: string;
}) {
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [sobre, setSobre] = useState<string | null>(null);

  return (
    // No celular cada coluna ocupa quase a tela e encaixa ao rolar; no desktop todas lado a lado.
    <div className="-mx-4 grid snap-x snap-mandatory auto-cols-[86%] grid-flow-col gap-3 overflow-x-auto scroll-px-4 px-4 pb-3 sm:auto-cols-[minmax(16rem,1fr)] md:mx-0 md:snap-none md:px-0">
      {colunas.map((coluna) => {
        const doGrupo = itens.filter((i) => etapaDe(i) === coluna.id);
        const resumo = resumoDaColuna?.(doGrupo) ?? null;
        return (
          <section
            key={coluna.id}
            aria-label={coluna.rotulo}
            onDragOver={(e) => {
              e.preventDefault();
              setSobre(coluna.id);
            }}
            onDragLeave={() => setSobre((atual) => (atual === coluna.id ? null : atual))}
            onDrop={(e) => {
              e.preventDefault();
              setSobre(null);
              const item = itens.find((i) => i.id === e.dataTransfer.getData("text/plain") || i.id === arrastando);
              if (item && etapaDe(item) !== coluna.id) aoMover(item, coluna.id);
              setArrastando(null);
            }}
            className={cn(
              "flex min-h-64 snap-start flex-col rounded-xl border border-transparent bg-ink-soft/70 transition-colors",
              sobre === coluna.id && "border-foreground/30 bg-ink-soft",
            )}
          >
            <header className="flex items-center gap-2 px-3 pt-3 pb-2">
              <span className={cn("size-2 rounded-full", PONTO_DA_ETAPA[coluna.id] ?? "bg-muted-foreground")} aria-hidden />
              <h2 className="text-sm font-semibold">{coluna.rotulo}</h2>
              <span className="rounded-md bg-card px-1.5 text-xs font-medium text-muted-foreground tabular shadow-xs">{doGrupo.length}</span>
              {resumo && <span className="ml-auto text-xs font-medium text-destructive">{resumo}</span>}
            </header>
            <ul className="flex flex-1 flex-col gap-2 px-2 pb-2">
              {doGrupo.map((item) => (
                <li
                  key={item.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", item.id);
                    e.dataTransfer.effectAllowed = "move";
                    setArrastando(item.id);
                  }}
                  onDragEnd={() => {
                    setArrastando(null);
                    setSobre(null);
                  }}
                  className={cn(
                    "group relative flex cursor-grab flex-col gap-2 rounded-lg border bg-card p-3 shadow-xs transition-[border-color,box-shadow,opacity] hover:border-foreground/25 hover:shadow-sm active:cursor-grabbing",
                    arrastando === item.id && "opacity-40",
                  )}
                >
                  {renderCartao(item)}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        aria-label={`Mover ${nomeDe(item)} para…`}
                        className="absolute top-1 right-1 z-10 grid size-11 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground md:top-2 md:right-2 md:size-7"
                      >
                        <MoreHorizontal className="size-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel className="text-xs text-muted-foreground">Mover para</DropdownMenuLabel>
                      {destinos(item).map((d) => (
                        <DropdownMenuItem key={d.id} onSelect={() => aoMover(item, d.id)}>
                          <span className={cn("size-2 rounded-full", PONTO_DA_ETAPA[d.id] ?? "bg-muted-foreground")} aria-hidden />
                          {d.rotulo}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </li>
              ))}
              {doGrupo.length === 0 && <li className="rounded-lg border border-dashed px-2 py-6 text-center text-xs text-muted-foreground">{vazio}</li>}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
