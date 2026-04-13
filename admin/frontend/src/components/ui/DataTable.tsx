import type { ReactNode } from "react";

type Column<T> = {
  key: string;
  header: string;
  sortable?: boolean;
  className?: string;
  render: (row: T) => ReactNode;
};

type DataTableProps<T> = {
  columns: Column<T>[];
  rows: T[];
  loading?: boolean;
  emptyMessage?: string;
  sortKey?: string;
  sortDir?: "asc" | "desc";
  onSort?: (key: string) => void;
};

export default function DataTable<T>({
  columns,
  rows,
  loading = false,
  emptyMessage = "No data available.",
  sortKey,
  sortDir = "desc",
  onSort,
}: DataTableProps<T>) {
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
      <table className="min-w-full divide-y divide-[var(--color-border)] text-sm">
        <thead className="bg-[var(--color-surface-secondary)]">
          <tr>
            {columns.map((column) => (
              <th key={column.key} className={`px-4 py-3 text-left font-medium text-[var(--color-text-secondary)] ${column.className ?? ""}`}>
                {column.sortable && onSort ? (
                  <button className="inline-flex items-center gap-1" type="button" onClick={() => onSort(column.key)}>
                    {column.header}
                    {sortKey === column.key ? <span>{sortDir === "asc" ? "▲" : "▼"}</span> : null}
                  </button>
                ) : (
                  column.header
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border)]">
          {loading
            ? Array.from({ length: 5 }).map((_, idx) => (
                <tr key={`skeleton-${idx}`}>
                  <td colSpan={columns.length} className="px-4 py-4">
                    <div className="h-4 animate-pulse rounded bg-[var(--color-primary-light)]" />
                  </td>
                </tr>
              ))
            : null}

          {!loading && rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-10 text-center text-[var(--color-text-secondary)]">
                {emptyMessage}
              </td>
            </tr>
          ) : null}

          {!loading
            ? rows.map((row, idx) => (
                <tr key={idx} className="hover:bg-[var(--color-surface-secondary)]/50">
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
