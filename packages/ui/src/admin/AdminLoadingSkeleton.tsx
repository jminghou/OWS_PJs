'use client';

import React from 'react';

export interface AdminLoadingSkeletonProps {
  variant: 'grid' | 'list' | 'table';
  count?: number;
  gridItemSize?: number;
  className?: string;
}

function GridSkeleton({ count = 14, gridItemSize = 180, className = '' }: { count?: number; gridItemSize?: number; className?: string }) {
  return (
    <div
      className={`grid gap-3 ${className}`}
      style={{ gridTemplateColumns: `repeat(auto-fill, ${gridItemSize}px)` }}
    >
      {[...Array(count)].map((_, i) => (
        <div
          key={i}
          className="bg-gray-200 rounded-lg animate-pulse"
          style={{ width: gridItemSize, height: gridItemSize }}
        />
      ))}
    </div>
  );
}

function ListSkeleton({ count = 10, className = '' }: { count?: number; className?: string }) {
  return (
    <div className={`space-y-4 ${className}`}>
      {[...Array(count)].map((_, i) => (
        <div key={i} className="flex items-center space-x-4 p-4 border border-gray-100 rounded-lg">
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-200 rounded animate-pulse" />
            <div className="h-3 bg-gray-200 rounded w-3/4 animate-pulse" />
          </div>
          <div className="flex space-x-2">
            <div className="w-16 h-8 bg-gray-200 rounded animate-pulse" />
            <div className="w-16 h-8 bg-gray-200 rounded animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

function TableSkeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`text-center py-12 ${className}`}>
      <div className="animate-pulse text-gray-500">載入中...</div>
    </div>
  );
}

export function AdminLoadingSkeleton({
  variant,
  count,
  gridItemSize,
  className,
}: AdminLoadingSkeletonProps) {
  switch (variant) {
    case 'grid':
      return <GridSkeleton count={count} gridItemSize={gridItemSize} className={className} />;
    case 'list':
      return <ListSkeleton count={count} className={className} />;
    case 'table':
      return <TableSkeleton className={className} />;
  }
}
