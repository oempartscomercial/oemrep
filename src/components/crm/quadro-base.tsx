"use client";

import { useState, type ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type ColunaQuadro = { id: string; rotulo: string };

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
  aoMover,
  vazio = "Nenhum cartão",
}: {
  colunas: ColunaQuadro[];
  itens: T[];
  etapaDe: (item: T) => string;
  nomeDe: (item: T) => string;
  destinos: (item: T) => ColunaQuadro[];
  renderCartao: (item: T) => ReactNode;
  aoMover: (item: T, para: string) => void;
  vazio?: string;
}) {
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [sobre, setSobre] = useState<string | null>(null);

  return (
    <div className="grid auto-cols-[minmax(15rem,1fr)] grid-flow-col gap-3 overflow-x-auto pb-2">
      {colunas.map((coluna) => {
        const doGrupo = itens.filter((i) => etapaDe(i) === coluna.id);
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
            className={cn("flex min-h-64 flex-col rounded-lg border bg-muted/40 transition-colors", sobre === coluna.id && "border-foreground/40 bg-muted")}
          >
            <header className="flex items-center justify-between px-3 py-2">
              <h2 className="text-xs font-medium">{coluna.rotulo}</h2>
              <span className="tabular text-xs text-muted-foreground">{doGrupo.length}</span>
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
                  className={cn("relative cursor-grab rounded-md border bg-card p-2.5 shadow-xs active:cursor-grabbing", arrastando === item.id && "opacity-40")}
                >
                  {renderCartao(item)}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        aria-label={`Mover ${nomeDe(item)} para…`}
                        className="absolute top-1.5 right-1.5 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <MoreHorizontal className="size-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {destinos(item).map((d) => (
                        <DropdownMenuItem key={d.id} onSelect={() => aoMover(item, d.id)}>
                          Mover para {d.rotulo}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </li>
              ))}
              {doGrupo.length === 0 && <li className="px-1 py-6 text-center text-xs text-muted-foreground">{vazio}</li>}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
