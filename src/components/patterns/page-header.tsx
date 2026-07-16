import type { ReactNode } from "react";

/**
 * Cabeçalho padrão de página: título, descrição opcional e área de ações.
 */
export function PageHeader({
  titulo,
  descricao,
  acoes,
}: {
  titulo: string;
  descricao?: string;
  acoes?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 border-b border-secondary pb-5 md:flex-row md:items-start md:justify-between">
      <div className="min-w-0">
        <h1 className="text-display-xs font-semibold text-primary">{titulo}</h1>
        {descricao && <p className="mt-1 text-md text-tertiary">{descricao}</p>}
      </div>
      {acoes && <div className="flex shrink-0 flex-wrap gap-3">{acoes}</div>}
    </div>
  );
}
