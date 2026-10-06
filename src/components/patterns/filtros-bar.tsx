import type { ReactNode } from "react";

/** Barra de filtros das telas de lista: controles lado a lado, quebrando no mobile. */
export function FiltrosBar({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">{children}</div>;
}
