"use client";

import type { Key, ReactNode } from "react";

export type TableColumn<T> = {
  id: string;
  header: ReactNode;
  accessor?: keyof T;
  render?: (row: T, index: number) => ReactNode;
  align?: "left" | "center" | "right";
  headerClassName?: string;
  className?: string;
  stopRowClick?: boolean;
};

export type TableProps<T extends object> = {
  data: readonly T[];
  columns?: readonly TableColumn<T>[];
  getRowKey?: (row: T, index: number) => Key;
  onRowClick?: (row: T, index: number) => void;
  isRowDisabled?: (row: T, index: number) => boolean;
  rowClassName?: string | ((row: T, index: number) => string);
  className?: string;
  tableClassName?: string;
  ariaLabel?: string;
  emptyMessage?: ReactNode;
  loading?: boolean;
  loadingMessage?: ReactNode;
};

const alignmentClasses = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

function formatValue(value: unknown): ReactNode {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string" || typeof value === "number") return value;
  if (value instanceof Date) return value.toLocaleString();
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function inferColumns<T extends object>(data: readonly T[]): TableColumn<T>[] {
  const keys = new Set(data.flatMap((row) => Object.keys(row)));
  return [...keys].map((key) => ({
    id: key,
    accessor: key as keyof T,
    header: key
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .replace(/[_-]+/g, " ")
      .trim()
      .replace(/\b\w/g, (letter) => letter.toUpperCase()),
  }));
}

function defaultRowKey(row: object, index: number): Key {
  const id = "id" in row ? row.id : "_id" in row ? row._id : undefined;
  return typeof id === "string" || typeof id === "number" ? id : index;
}

export default function Table<T extends object>({
  data,
  columns,
  getRowKey = defaultRowKey,
  onRowClick,
  isRowDisabled,
  rowClassName,
  className = "",
  tableClassName = "",
  ariaLabel,
  emptyMessage = "No data found.",
  loading = false,
  loadingMessage = "Loading...",
}: TableProps<T>) {
  const resolvedColumns = columns ?? inferColumns(data);

  return (
    <div className={`overflow-x-auto ${className}`}>
      <table
        aria-label={ariaLabel}
        aria-busy={loading || undefined}
        className={`min-w-full divide-y divide-gray-200 text-left text-sm ${tableClassName}`}
      >
        <thead className="bg-gray-50">
          <tr className="text-gray-600">
            {resolvedColumns.map((column) => (
              <th
                key={column.id}
                scope="col"
                className={`px-3 py-2 align-middle font-medium ${alignmentClasses[column.align ?? "left"]} ${column.headerClassName ?? ""}`}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {loading || data.length === 0 ? (
            <tr>
              <td
                colSpan={Math.max(resolvedColumns.length, 1)}
                className="px-3 py-6 text-center text-gray-500"
              >
                {loading ? loadingMessage : emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, index) => {
              const disabled = isRowDisabled?.(row, index) ?? false;
              const rowClasses = typeof rowClassName === "function"
                ? rowClassName(row, index)
                : rowClassName ?? "hover:bg-gray-50";

              return (
                <tr
                  key={getRowKey(row, index)}
                  tabIndex={onRowClick ? (disabled ? -1 : 0) : undefined}
                  aria-disabled={onRowClick && disabled ? true : undefined}
                  onClick={onRowClick ? () => {
                    if (!disabled) onRowClick(row, index);
                  } : undefined}
                  onKeyDown={onRowClick ? (event) => {
                    if (
                      !disabled &&
                      event.target === event.currentTarget &&
                      (event.key === "Enter" || event.key === " ")
                    ) {
                      event.preventDefault();
                      onRowClick(row, index);
                    }
                  } : undefined}
                  className={`${onRowClick ? disabled ? "cursor-not-allowed" : "cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500" : ""} ${rowClasses}`}
                >
                  {resolvedColumns.map((column) => (
                    <td
                      key={column.id}
                      onClick={column.stopRowClick ? (event) => event.stopPropagation() : undefined}
                      onKeyDown={column.stopRowClick ? (event) => event.stopPropagation() : undefined}
                      className={`px-3 py-1.5 align-middle ${alignmentClasses[column.align ?? "left"]} ${column.className ?? ""}`}
                    >
                      {column.render
                        ? column.render(row, index)
                        : formatValue(row[(column.accessor ?? column.id) as keyof T])}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
