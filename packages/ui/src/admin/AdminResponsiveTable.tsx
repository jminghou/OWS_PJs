'use client';

import React from 'react';

export interface AdminTableColumn<T> {
  key: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  className?: string;
  headerClassName?: string;
}

export interface AdminResponsiveTableProps<T> {
  rows: T[];
  rowKey: (row: T) => string | number;
  columns: AdminTableColumn<T>[];
  /** 手機（< md）每筆的卡片內容。 */
  renderCard: (row: T) => React.ReactNode;
  empty?: React.ReactNode;
  tableClassName?: string;
  rowClassName?: (row: T) => string;
}

/** md 以上是表格；手機改成一筆一張卡片，避免多欄表格被擠扁或要橫向捲動。 */
export function AdminResponsiveTable<T>({
  rows,
  rowKey,
  columns,
  renderCard,
  empty,
  tableClassName = '',
  rowClassName,
}: AdminResponsiveTableProps<T>) {
  if (rows.length === 0 && empty) return <>{empty}</>;

  return (
    <>
      <div className="hidden md:block overflow-x-auto">
        <table className={`w-full text-sm ${tableClassName}`}>
          <thead>
            <tr className="text-left text-muted-foreground border-b border-border">
              {columns.map((c) => (
                <th key={c.key} className={`px-3 py-2 font-medium ${c.headerClassName ?? ''}`}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={rowKey(row)} className={`border-b border-border last:border-0 align-top ${rowClassName?.(row) ?? ''}`}>
                {columns.map((c) => (
                  <td key={c.key} className={`px-3 py-2 ${c.className ?? ''}`}>
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="md:hidden space-y-2">
        {rows.map((row) => (
          <li key={rowKey(row)} className="rounded-lg border border-border bg-card p-3">
            {renderCard(row)}
          </li>
        ))}
      </ul>
    </>
  );
}
