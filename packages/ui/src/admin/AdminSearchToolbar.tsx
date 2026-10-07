'use client';

import React from 'react';

export interface AdminSearchToolbarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  variant?: 'underline' | 'bordered';
  filters?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export function AdminSearchToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search',
  variant = 'underline',
  filters,
  actions,
  className = '',
}: AdminSearchToolbarProps) {
  const inputClassName = variant === 'underline'
    ? 'w-full pb-2 text-lg border-0 border-b border-gray-300 bg-transparent focus:outline-none focus:border-gray-500 placeholder-gray-400 transition-colors'
    : 'w-full px-3 py-2 border border-gray-300 rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400 transition-colors';

  return (
    <div className={`flex flex-wrap items-end gap-x-4 gap-y-3 ${className}`}>
      <div className="flex-1 basis-full sm:basis-auto min-w-0">
        <input
          type="text"
          placeholder={searchPlaceholder}
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          className={inputClassName}
        />
      </div>
      {filters && (
        <div className="flex flex-wrap items-center gap-3">
          {filters}
        </div>
      )}
      {actions && (
        <div className="flex flex-wrap items-center gap-3 pb-1">
          {actions}
        </div>
      )}
    </div>
  );
}
