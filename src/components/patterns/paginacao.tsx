import Link from "next/link";
import { cx } from "@/utils/cx";

/** Paginação por links (?pagina=N), mantendo os outros filtros da URL. */
export function Paginacao({
  pagina,
  total,
  porPagina,
  caminho,
  params,
}: {
  pagina: number;
  total: number;
  porPagina: number;
  caminho: string;
  params: Record<string, string | undefined>;
}) {
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  if (paginas === 1) return null;

  const href = (p: number) => {
    const busca = new URLSearchParams(Object.entries({ ...params, pagina: String(p) }).filter(([, v]) => v) as [string, string][]);
    return `${caminho}?${busca.toString()}`;
  };
  const botao = (p: number, rotulo: string, ativo: boolean) =>
    ativo ? (
      <Link href={href(p)} className="rounded-md px-3 py-1.5 text-sm font-medium text-secondary ring-1 ring-primary hover:bg-primary_hover">
        {rotulo}
      </Link>
    ) : (
      <span className={cx("rounded-md px-3 py-1.5 text-sm font-medium text-disabled ring-1 ring-secondary")}>{rotulo}</span>
    );

  return (
    <nav aria-label="Paginação" className="flex items-center justify-between gap-3">
      <p className="text-sm text-tertiary">
        Página {pagina} de {paginas} · {total} registros
      </p>
      <div className="flex gap-2">
        {botao(pagina - 1, "Anterior", pagina > 1)}
        {botao(pagina + 1, "Próxima", pagina < paginas)}
      </div>
    </nav>
  );
}
