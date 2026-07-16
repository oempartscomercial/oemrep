import type { ReactNode } from "react";
import { Table, TableCard } from "@/components/application/table/table";

export interface DataTableColumn<T> {
  id: string;
  header: ReactNode;
  isRowHeader?: boolean;
  render: (row: T) => ReactNode;
}

/**
 * Envolve a Table (React Aria) do Untitled UI numa API simples de colunas + dados,
 * centralizando o boilerplate de coleção. Opcionalmente envolve num cartão com título.
 */
export function DataTable<T>({
  ariaLabel,
  columns,
  data,
  getRowId,
  rowHref,
  titulo,
  descricao,
  contadorBadge,
  acoesTopo,
  vazio = "Nenhum registro encontrado.",
  size = "md",
}: {
  ariaLabel: string;
  columns: DataTableColumn<T>[];
  data: T[];
  getRowId: (row: T) => string;
  rowHref?: (row: T) => string | undefined;
  titulo?: string;
  descricao?: string;
  contadorBadge?: string;
  acoesTopo?: ReactNode;
  vazio?: ReactNode;
  size?: "sm" | "md";
}) {
  const tabela = (
    <Table aria-label={ariaLabel} selectionMode="none" size={size}>
      <Table.Header>
        {columns.map((col) => (
          <Table.Head key={col.id} id={col.id} isRowHeader={col.isRowHeader}>
            {col.header}
          </Table.Head>
        ))}
      </Table.Header>
      <Table.Body items={data} renderEmptyState={() => <div className="p-8 text-center text-sm text-tertiary">{vazio}</div>}>
        {(row) => (
          <Table.Row id={getRowId(row)} href={rowHref?.(row)}>
            {columns.map((col) => (
              <Table.Cell key={col.id}>{col.render(row)}</Table.Cell>
            ))}
          </Table.Row>
        )}
      </Table.Body>
    </Table>
  );

  if (!titulo && !acoesTopo) {
    return <TableCard.Root size={size}>{tabela}</TableCard.Root>;
  }

  return (
    <TableCard.Root size={size}>
      <TableCard.Header title={titulo ?? ""} badge={contadorBadge} description={descricao} contentTrailing={acoesTopo} />
      {tabela}
    </TableCard.Root>
  );
}
