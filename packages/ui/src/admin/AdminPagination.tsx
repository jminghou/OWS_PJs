'use client';

import React from 'react';

export interface PaginationData {
  page: number;
  pages: number;
  has_prev: boolean;
  has_next: boolean;
}

export interface AdminPaginationProps {
  pagination: PaginationData;
  currentPage: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export function AdminPagination({
  pagination,
  currentPage,
  onPageChange,
  className = '',
}: AdminPaginationProps) {
  if (pagination.pages <= 1) return null;

  return (
    <div className={`flex justify-center items-center space-x-2 ${className}`}>
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={!pagination.has_prev}
        className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 rounded-md px-3 ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
      >
        上一頁
      </button>
      <span className="text-sm text-gray-600">
        第 {pagination.page} 頁，共 {pagination.pages} 頁
      </span>
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={!pagination.has_next}
        className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 rounded-md px-3 ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
      >
        下一頁
      </button>
    </div>
  );
}
