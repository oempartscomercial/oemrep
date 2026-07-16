import type { ReactNode } from "react";
import { cx } from "@/utils/cx";

export interface TimelineItem {
  id: string;
  titulo: string;
  descricao?: ReactNode;
  data?: string;
  autor?: string;
  destaque?: boolean; // usa o accent vermelho (ex.: EXTRAVIADO)
}

/**
 * Linha do tempo vertical de eventos (ex.: histórico de rastreio de NFe).
 */
export function Timeline({ eventos }: { eventos: TimelineItem[] }) {
  return (
    <ol className="flex flex-col">
      {eventos.map((ev, i) => {
        const ultimo = i === eventos.length - 1;
        return (
          <li key={ev.id} className="relative flex gap-4 pb-6 last:pb-0">
            {!ultimo && <span className="absolute top-3 left-[5px] h-full w-px bg-border-secondary" aria-hidden />}
            <span
              className={cx(
                "relative z-1 mt-1.5 size-2.5 shrink-0 rounded-full ring-4 ring-bg-primary",
                ev.destaque ? "bg-fg-error-primary" : "bg-fg-brand-primary",
              )}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <p className="text-sm font-semibold text-primary">{ev.titulo}</p>
                {ev.data && <time className="text-xs text-tertiary">{ev.data}</time>}
              </div>
              {ev.descricao && <div className="mt-0.5 text-sm text-tertiary">{ev.descricao}</div>}
              {ev.autor && <p className="mt-0.5 text-xs text-quaternary">por {ev.autor}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
