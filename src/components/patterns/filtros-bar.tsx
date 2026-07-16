import type { ReactNode } from "react";

/**
 * Barra de filtros das telas de lista. Agrupa controles (Select, Input de busca, etc.)
 * com espaçamento e quebra responsiva consistentes.
 */
export function FiltrosBar({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      {children}
    </div>
  );
}
