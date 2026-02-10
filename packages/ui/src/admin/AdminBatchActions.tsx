'use client';

import React from 'react';

export interface AdminBatchActionsProps {
  totalCount: number;
  selectedIds: number[];
  onSelectionChange: (ids: number[]) => void;
  allIds: number[];
  children: React.ReactNode;
  selectAllLabel?: string;
  selectedLabel?: (count: number) => string;
}

export function AdminBatchActions({
  totalCount,
  selectedIds,
  onSelectionChange,
  allIds,
  children,
  selectAllLabel = '全選',
  selectedLabel = (count: number) => `已選 ${count} 項`,
}: AdminBatchActionsProps) {
  const isAllSelected = selectedIds.length === totalCount && totalCount > 0;

  const toggleSelectAll = () => {
    if (isAllSelected) {
      onSelectionChange([]);
    } else {
      onSelectionChange(allIds);
    }
  };

  return (
    <>
      {totalCount > 0 && (
        <label className="flex items-center gap-1.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={isAllSelected}
            onChange={toggleSelectAll}
            className="w-4 h-4 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500"
          />
          <span className="text-sm text-gray-600 whitespace-nowrap">{selectAllLabel}</span>
        </label>
      )}
      {selectedIds.length > 0 && (
        <>
          <span className="text-sm text-blue-700 whitespace-nowrap">
            {selectedLabel(selectedIds.length)}
          </span>
          {children}
        </>
      )}
    </>
  );
}
