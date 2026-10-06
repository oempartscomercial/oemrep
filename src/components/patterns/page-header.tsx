import type { ReactNode } from "react";

/** Cabeçalho de página: título, descrição opcional e ações à direita. */
export function PageHeader({ titulo, descricao, acoes }: { titulo: string; descricao?: string; acoes?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0">
        <h1 className="text-lg font-semibold tracking-tight">{titulo}</h1>
        {descricao && <p className="mt-0.5 text-sm text-muted-foreground">{descricao}</p>}
      </div>
      {acoes && <div className="flex shrink-0 flex-wrap items-center gap-2">{acoes}</div>}
    </div>
  );
}
