import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface TimelineItem {
  id: string;
  titulo: string;
  descricao?: ReactNode;
  data?: string;
  autor?: string;
  destaque?: boolean; // vermelho da OEM (ex.: EXTRAVIADO)
}

/** Linha do tempo vertical de eventos (rastreio, histórico do pedido, ficha da empresa). */
export function Timeline({ eventos }: { eventos: TimelineItem[] }) {
  return (
    <ol className="flex flex-col">
      {eventos.map((ev, i) => (
        <li key={ev.id} className="relative flex gap-3 pb-5 last:pb-0">
          {i < eventos.length - 1 && <span className="absolute top-3 left-[4px] h-full w-px bg-border" aria-hidden />}
          <span
            className={cn("relative z-10 mt-1.5 size-2 shrink-0 rounded-full ring-4 ring-background", ev.destaque ? "bg-destructive" : "bg-foreground/60")}
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <p className="text-sm font-medium">{ev.titulo}</p>
              {ev.data && <time className="text-xs text-muted-foreground">{ev.data}</time>}
            </div>
            {ev.descricao && <div className="mt-0.5 text-sm text-muted-foreground">{ev.descricao}</div>}
            {ev.autor && <p className="mt-0.5 text-xs text-muted-foreground/70">por {ev.autor}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
