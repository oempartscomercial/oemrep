"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export interface DataTableColumn<T> {
  id: string;
  header: ReactNode;
  isRowHeader?: boolean;
  /** Alinha à direita (valores numéricos). */
  numerica?: boolean;
  render: (row: T) => ReactNode;
}

/**
 * Tabela densa, estilo planilha. API simples de colunas + dados; `rowHref` torna a
 * linha inteira clicável (navegação por teclado via Enter).
 */
export function DataTable<T>({
  ariaLabel,
  columns,
  data,
  getRowId,
  rowHref,
  titulo,
  descricao,
  acoesTopo,
  vazio = "Nenhum registro encontrado.",
}: {
  ariaLabel: string;
  columns: DataTableColumn<T>[];
  data: T[];
  getRowId: (row: T) => string;
  rowHref?: (row: T) => string | undefined;
  titulo?: string;
  descricao?: string;
  acoesTopo?: ReactNode;
  vazio?: ReactNode;
}) {
  const router = useRouter();
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      {(titulo || acoesTopo) && (
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <div>
            {titulo && <h2 className="text-sm font-semibold">{titulo}</h2>}
            {descricao && <p className="text-xs text-muted-foreground">{descricao}</p>}
          </div>
          {acoesTopo}
        </div>
      )}
      <Table aria-label={ariaLabel}>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            {columns.map((col) => (
              <TableHead key={col.id} className={cn("h-8 px-3 text-xs font-medium text-muted-foreground", col.numerica && "text-right")}>
                {col.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 && (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={columns.length} className="px-3 py-10 text-center text-sm text-muted-foreground">
                {vazio}
              </TableCell>
            </TableRow>
          )}
          {data.map((row) => {
            const href = rowHref?.(row);
            return (
              <TableRow
                key={getRowId(row)}
                className={cn(href && "cursor-pointer")}
                tabIndex={href ? 0 : undefined}
                onClick={href ? () => router.push(href) : undefined}
                onKeyDown={href ? (e) => e.key === "Enter" && router.push(href) : undefined}
              >
                {columns.map((col) => (
                  <TableCell key={col.id} className={cn("px-3 py-2 text-sm", col.isRowHeader && "font-medium", col.numerica && "text-right tabular")}>
                    {col.render(row)}
                  </TableCell>
                ))}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
