import type { ReactNode } from "react";

type Column<T> = {
  key: string;
  header: string;
  className?: string;
  render: (row: T) => ReactNode;
};

type DataTableProps<T> = {
  columns: Column<T>[];
  rows: T[];
  loading?: boolean;
  emptyMessage?: string;
};

export default function DataTable<T>({
  columns,
  rows,
  loading = false,
  emptyMessage = "No data available.",
}: DataTableProps<T>) {
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
      <table className="min-w-full divide-y divide-[var(--color-border)] text-sm">
        <thead className="bg-[var(--color-surface-secondary)]">
          <tr>
            {columns.map((column) => (
              <th key={column.key} className={`px-4 py-3 text-left font-medium text-[var(--color-text-secondary)] ${column.className ?? ""}`}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border)]">
          {loading
            ? Array.from({ length: 5 }).map((_, index) => (
                <tr key={`skeleton-${index}`}>
                  <td colSpan={columns.length} className="px-4 py-4">
                    <div className="h-4 animate-pulse rounded bg-[var(--color-primary-light)]" />
                  </td>
                </tr>
              ))
            : null}

          {!loading && rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-[var(--color-text-secondary)]">
                {emptyMessage}
              </td>
            </tr>
          ) : null}

          {!loading
            ? rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="hover:bg-[var(--color-surface-secondary)]/60">
                  {columns.map((column) => (
                    <td key={column.key} className={`px-4 py-3 text-[var(--color-text-primary)] ${column.className ?? ""}`}>
                      {column.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            : null}
        </tbody>
      </table>
    </div>
  );
}
