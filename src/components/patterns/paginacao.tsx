import Link from "next/link";
import { Button } from "@/components/ui/button";

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
      <Button variant="outline" size="sm" asChild>
        <Link href={href(p)}>{rotulo}</Link>
      </Button>
    ) : (
      <Button variant="outline" size="sm" disabled>
        {rotulo}
      </Button>
    );

  return (
    <nav aria-label="Paginação" className="flex items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground">
        Página {pagina} de {paginas} · {total} registros
      </p>
      <div className="flex gap-2">
        {botao(pagina - 1, "Anterior", pagina > 1)}
        {botao(pagina + 1, "Próxima", pagina < paginas)}
      </div>
    </nav>
  );
}
